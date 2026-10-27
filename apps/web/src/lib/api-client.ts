import axios from 'axios';
import { API_BASE_URL } from './constants';
import { sanitizePayload } from './helpers';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// Request Interceptor: Attaches JWT Bearer token and sanitizes all outbound inputs
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      try {
        const rawSession =
          window.localStorage.getItem('ts_auth_s') ||
          window.localStorage.getItem('ticketsupport_auth_session');
        if (rawSession && !config.headers.Authorization) {
          const parsed = JSON.parse(rawSession);
          if (parsed?.accessToken) {
            config.headers.Authorization = `Bearer ${parsed.accessToken}`;
          }
        }
      } catch {
        // Ignore storage read errors
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
