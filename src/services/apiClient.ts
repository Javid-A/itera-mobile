import axios from 'axios';
import { getToken, clearAuthData } from './tokenStorage';

const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

// Attach JWT to every request
apiClient.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear credentials so auth guard redirects to login
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await clearAuthData();
    }
    return Promise.reject(error);
  }
);

export default apiClient;
