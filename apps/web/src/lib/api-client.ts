import axios from 'axios';
import { API_BASE_URL } from './constants';
import { sanitizePayload } from './helpers';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

let tokenGetter: (() => string | null) | null = null;

/**
 * Registers a runtime token provider (e.g. from the in-memory auth store)
 * to avoid storing or reading tokens in plaintext from client web storage.
 */
export function registerAuthTokenGetter(getter: () => string | null): void {
  tokenGetter = getter;
}

// Request Interceptor: Attaches JWT Bearer token and sanitizes all outbound inputs
apiClient.interceptors.request.use(
  (config) => {
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

// Response Interceptor: Sanitizes all inbound data from the backend before UI rendering
apiClient.interceptors.response.use(
  (response) => {
    if (response.data !== undefined && response.data !== null) {
      response.data = sanitizePayload(response.data);
    }
    return response;
  },
  (error) => Promise.reject(error),
);
