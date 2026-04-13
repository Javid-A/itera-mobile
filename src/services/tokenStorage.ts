import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'itera_jwt';
const USER_ID_KEY = 'itera_user_id';
const USERNAME_KEY = 'itera_username';

export async function saveAuthData(token: string, userId: string, username: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY, token),
    SecureStore.setItemAsync(USER_ID_KEY, userId),
    SecureStore.setItemAsync(USERNAME_KEY, username),
  ]);
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getStoredUser(): Promise<{ userId: string; username: string } | null> {
  const [userId, username] = await Promise.all([
    SecureStore.getItemAsync(USER_ID_KEY),
    SecureStore.getItemAsync(USERNAME_KEY),
  ]);
  if (!userId || !username) return null;
  return { userId, username };
}

export async function clearAuthData(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_ID_KEY),
    SecureStore.deleteItemAsync(USERNAME_KEY),
  ]);
}
