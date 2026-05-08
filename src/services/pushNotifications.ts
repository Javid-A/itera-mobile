import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerPushToken } from '../api/profile';

const STORAGE_KEY = 'pushToken:lastRegistered';

// Foreground notification behavior — show banner + sound + list entry while
// the app is open. Banners on iOS require both shouldShowBanner and
// shouldShowList in the new API.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#E8EAF6',
  });
}

async function requestPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  if (!existing.canAskAgain) return false;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

function resolveProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants.easConfig as { projectId?: string } | undefined)?.projectId
  );
}

// Idempotent: tries to fetch an Expo push token and POSTs it to the backend.
// Safe to call on every login + cold start; we de-dupe via AsyncStorage so the
// backend doesn't see redundant writes when the token hasn't rotated.
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  await ensureAndroidChannel();

  const granted = await requestPermission();
  if (!granted) return null;

  const projectId = resolveProjectId();
  if (!projectId) {
    // EAS projectId not configured yet — getExpoPushTokenAsync would throw.
    // Skip silently in dev until `eas init` runs.
    console.warn('[push] No EAS projectId; skipping token fetch. Run `eas init`.');
    return null;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const lastSent = await AsyncStorage.getItem(STORAGE_KEY);
    if (lastSent !== token) {
      await registerPushToken(token);
      await AsyncStorage.setItem(STORAGE_KEY, token);
    }
    return token;
  } catch (err) {
    console.warn('[push] Failed to register token', err);
    return null;
  }
}

export async function clearPushTokenCache() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
