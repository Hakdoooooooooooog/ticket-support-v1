import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from './constants';
import { sanitizePayload } from './helpers';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

let tokenGetter: (() => string | null) | null = null;
let sessionSetter: ((session: { accessToken: string; user?: any }) => void) | null = null;
let authFailureHandler: (() => void) | null = null;

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: any) => void;
}> = [];

function processQueue(error: any, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

/**
 * Registers a runtime token provider (e.g. from the in-memory auth store)
 * to avoid storing or reading tokens in plaintext from client web storage.
 */
export function registerAuthTokenGetter(getter: () => string | null): void {
  tokenGetter = getter;
}

/**
 * Registers auth session handler callbacks to update Zustand store
 * when token rotation occurs or when refresh fails permanently.
 */
export function registerAuthSessionHandler(
  setter: (session: { accessToken: string; user?: any }) => void,
  onFailure?: () => void,
): void {
  sessionSetter = setter;
  if (onFailure) {
    authFailureHandler = onFailure;
  }
}

// Request Interceptor: Attaches JWT Bearer token and sanitizes all outbound inputs
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (!config.headers.Authorization && tokenGetter) {
      const activeToken = tokenGetter();
      if (activeToken) {
        config.headers.Authorization = `Bearer ${activeToken}`;
      }
    }

    if (config.data && typeof config.data === 'object') {
      config.data = sanitizePayload(config.data);
    }
    if (config.params && typeof config.params === 'object') {
      config.params = sanitizePayload(config.params);
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// Response Interceptor: Sanitizes inbound data and transparently rotates expired tokens on 401
apiClient.interceptors.response.use(
  (response) => {
    if (
      response.config.responseType === 'blob' ||
      response.config.responseType === 'arraybuffer' ||
      response.config.responseType === 'stream'
    ) {
      return response;
    }
    if (response.data !== undefined && response.data !== null) {
      response.data = sanitizePayload(response.data);
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const url = originalRequest.url || '';
    const isAuthEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/logout');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshRes = await axios.post<{
          accessToken: string;
          user?: any;
        }>(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true },
        );

        const newAccessToken = refreshRes.data.accessToken;
        if (sessionSetter && newAccessToken) {
          sessionSetter({
            accessToken: newAccessToken,
            user: refreshRes.data.user,
          });
        }

        processQueue(null, newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        if (authFailureHandler) {
          authFailureHandler();
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
