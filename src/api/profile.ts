import apiClient from '../services/apiClient';
import type { Profile } from '../types/Profile';

export async function getProfile(): Promise<Profile> {
  const { data } = await apiClient.get<Profile>('/profile');
  return data;
}

export async function resetProfileStats(): Promise<void> {
  await apiClient.delete('/profile/stats');
}

export async function registerPushToken(expoPushToken: string): Promise<void> {
  await apiClient.post('/profile/push-token', { expoPushToken });
}

export async function deletePushToken(): Promise<void> {
  await apiClient.delete('/profile/push-token');
}

export async function updateEmail(email: string): Promise<void> {
  await apiClient.post('/profile/email', { email });
}
