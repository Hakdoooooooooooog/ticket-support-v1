import type { AxiosRequestConfig } from 'axios';
import { apiClient } from './api-client';

export const customInstance = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => {
  let url = config.url;
  if (url && (url.startsWith('http://localhost:3001') || url.startsWith('http://127.0.0.1:3001'))) {
    url = url.replace(/^http:\/\/(localhost|127\.0\.0\.1):3001/, '');
  }

  return apiClient({
    ...config,
    url,
    ...options,
  }).then((res) => res.data as T);
};

export default customInstance;
