import apiClient from '../services/apiClient';

export interface AuthResponse {
  token: string;
  userId: string;
  username: string;
}

export interface AuthCredentials {
  username: string;
  password: string;
  timeZone: string;
}

export async function login(credentials: AuthCredentials): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', credentials);
  return data;
}

export async function register(credentials: AuthCredentials): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/register', credentials);
  return data;
}
