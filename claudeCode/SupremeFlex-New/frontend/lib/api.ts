import axios from 'axios';

// PHP/Laravel API — master data, campaigns, customers, etc.
export const phpApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_PHP || 'http://localhost:8000/api',
});

// Node.js API — field execution, stock transfers, dashboards
export const nodeApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_NODE || 'http://localhost:8001/api',
});

// Attach JWT token from localStorage on every request
function attachToken(instance: ReturnType<typeof axios.create>) {
  instance.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('sf_token');
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
}

attachToken(phpApi);
attachToken(nodeApi);
