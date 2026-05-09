import apiClient from '../services/apiClient';

export interface AuthResponse {
  token: string;
  userId: string;
  username: string;
  email?: string;
  emailVerified: boolean;
}

export interface AuthCredentials {
  username: string;
  password: string;
  timeZone: string;
}

export interface RegisterCredentials extends AuthCredentials {
  email: string;
}

export async function login(credentials: AuthCredentials): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', credentials);
  return data;
}

export async function register(credentials: RegisterCredentials): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/register', credentials);
  return data;
}

export async function sendVerificationCode(): Promise<void> {
  await apiClient.post('/auth/send-verification');
}

export async function verifyEmail(code: string): Promise<void> {
  await apiClient.post('/auth/verify-email', { code });
}

export async function forgotPassword(email: string): Promise<void> {
  await apiClient.post('/auth/forgot-password', { email });
}

export async function resetPassword(email: string, code: string, newPassword: string): Promise<void> {
  await apiClient.post('/auth/reset-password', { email, code, newPassword });
}
