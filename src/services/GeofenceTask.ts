import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { GeofencingEventType, type LocationRegion } from 'expo-location';
import { AppState } from 'react-native';
import axios from 'axios';
import apiClient from './apiClient';

import AsyncStorage from '@react-native-async-storage/async-storage';

export const GEOFENCE_TASK_NAME = 'itera-geofence-task';

TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[GeofenceTask] Error:', error.message);
    return;
  }

  try {
    const isAutoTrackingEnabled = await AsyncStorage.getItem('autoTrackingEnabled');
    if (isAutoTrackingEnabled === 'false') {
      console.log('[GeofenceTask] Auto-tracking is disabled in settings. Ignoring geofence event.');
      return;
    }
  } catch (e) {
    console.warn('[GeofenceTask] Failed to read autoTrackingEnabled setting', e);
  }

  const { eventType, region } = data as {
    eventType: GeofencingEventType;
    region: LocationRegion;
  };

  if (eventType !== GeofencingEventType.Enter) return;

  // If the app is in the foreground, the map screen's live-watcher owns the
  // arrival flow (including the shrink/burst animation). Bailing here prevents
  // the backend cooldown from being tripped before the foreground POST lands.
  if (AppState.currentState === 'active') {
    console.log('[GeofenceTask] App active — deferring to foreground handler');
    return;
  }

  const routineId = region.identifier;
  if (!routineId) return;

  let latitude = region.latitude;
  let longitude = region.longitude;
  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    latitude = pos.coords.latitude;
    longitude = pos.coords.longitude;
  } catch {
    // fall back to region centre
  }

  try {
    const { data: result } = await apiClient.post('/missions/arrive', {
      routineId,
      latitude,
      longitude,
    });

    if (result.cooldownActive) {
      console.log(`[GeofenceTask] Cooldown active for: ${routineId}`);
      return;
    }

    console.log(`[GeofenceTask] Completed: ${result.missionName} +${result.earnedXP} XP (Level ${result.currentLevel})`);

    try {
      const Notifications = require('expo-notifications');
      await Notifications.scheduleNotificationAsync({
        content: {
          title: result.leveledUp ? 'Level Up!' : 'Mission Complete!',
          body: `${result.missionName} — +${result.earnedXP} XP`,
        },
        trigger: null,
      });
    } catch {
      // Native module unavailable (Expo Go)
    }
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 400) {
      const msg = (e.response.data as { error?: string } | undefined)?.error ?? 'validation failed';
      console.warn(`[GeofenceTask] Arrival rejected (${routineId}): ${msg}`);
      return;
    }
    console.error('[GeofenceTask] Failed to process arrival:', e);
  }
});
