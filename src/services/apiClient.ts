import axios from 'axios';
import { getToken, clearAuthData } from './tokenStorage';

const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

// AuthContext bu callback'i mount'ta register ediyor; 401'de React state'i
// (isAuthenticated) flip'lemek için tetiklenir, böylece RootNavigator login'e
// yönlendirir. Modül seviyesinde tutuluyor çünkü interceptor React tree dışında.
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

// Attach JWT to every request
apiClient.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear credentials AND notify AuthContext so the guard redirects.
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await clearAuthData();
      onUnauthorized?.();
    }
    return Promise.reject(error);
  }
);

export default apiClient;
