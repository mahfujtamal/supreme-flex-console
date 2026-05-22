import axios from 'axios';
import { getAccessTokenGlobal, setAccessTokenGlobal } from '@/contexts/AuthContext';

// PHP/Laravel API — master data, campaigns, customers, etc.
export const phpApi = axios.create({
  baseURL:         process.env.NEXT_PUBLIC_API_PHP || 'http://localhost:8000/api',
  withCredentials: true,
  timeout:         15000,
});

// Node.js API — field execution, stock transfers, dashboards
export const nodeApi = axios.create({
  baseURL:         process.env.NEXT_PUBLIC_API_NODE || 'http://localhost:8001/api',
  withCredentials: true,
  timeout:         15000,
});

// Attach access token from memory on every request (both backends accept Bearer)
function attachToken(instance: ReturnType<typeof axios.create>) {
  instance.interceptors.request.use(config => {
    const token = getAccessTokenGlobal();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
}

attachToken(phpApi);
attachToken(nodeApi);

// 401 interceptor on phpApi: attempt one silent refresh then retry
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

phpApi.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config;
    if (
      err.response?.status !== 401 ||
      original._retried ||
      original.url?.includes('/auth/refresh')
    ) {
      return Promise.reject(err);
    }
    original._retried = true;

    if (isRefreshing) {
      return new Promise(resolve => {
        refreshQueue.push(token => {
          original.headers.Authorization = `Bearer ${token}`;
          resolve(phpApi(original));
        });
      });
    }

    isRefreshing = true;
    try {
      const { data } = await phpApi.post<{ access_token: string }>('/auth/refresh');
      setAccessTokenGlobal(data.access_token);
      refreshQueue.forEach(cb => cb(data.access_token));
      refreshQueue = [];
      original.headers.Authorization = `Bearer ${data.access_token}`;
      return phpApi(original);
    } catch {
      refreshQueue = [];
      setAccessTokenGlobal(null);
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  }
);
