import apiClient from '../services/apiClient';
import type { Profile } from '../types/Profile';

export async function getProfile(): Promise<Profile> {
  const { data } = await apiClient.get<Profile>('/profile');
  return data;
}

export async function resetProfileStats(): Promise<void> {
  await apiClient.delete('/profile/stats');
}
