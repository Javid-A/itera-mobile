import { Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';

/**
 * Opens the app's settings page where the user can change permissions.
 * On Android we try to land on the app's Permissions list (one tap from
 * Location); fall back to App Info if the intent is unavailable.
 */
export async function openAppPermissions(): Promise<void> {
  if (Platform.OS === 'android') {
    const pkg =
      Constants.expoConfig?.android?.package ??
      (Constants as unknown as { easConfig?: { android?: { package?: string } } })
        .easConfig?.android?.package;
    if (pkg) {
      try {
        await IntentLauncher.startActivityAsync(
          'android.intent.action.MANAGE_APP_PERMISSIONS',
          { data: `package:${pkg}` },
        );
        return;
      } catch {
        // fall through to generic settings
      }
    }
  }
  Linking.openSettings();
}

/**
 * Requests background location. If the OS shows the native prompt, great.
 * If Android blocks it (previously denied), opens settings directly.
 */
export async function requestForegroundLocation(): Promise<boolean> {
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status === 'granted') return true;
  const req = await Location.requestForegroundPermissionsAsync();
  if (req.status === 'granted') return true;
  await openAppPermissions();
  return false;
}

export async function requestBackgroundLocation(): Promise<boolean> {
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== 'granted') {
    const req = await Location.requestForegroundPermissionsAsync();
    if (req.status !== 'granted') {
      await openAppPermissions();
      return false;
    }
  }

  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status === 'granted') return true;

  await openAppPermissions();
  return false;
}
