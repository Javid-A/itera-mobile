import * as TaskManager from 'expo-task-manager';
import { GeofencingEventType, type LocationRegion } from 'expo-location';
import apiClient from './apiClient';

export const GEOFENCE_TASK_NAME = 'itera-geofence-task';

TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[GeofenceTask] Error:', error.message);
    return;
  }

  const { eventType, region } = data as {
    eventType: GeofencingEventType;
    region: LocationRegion;
  };

  if (eventType !== GeofencingEventType.Enter) return;

  const routineId = region.identifier;
  if (!routineId) return;

  try {
    const { data: result } = await apiClient.post('/missions/arrive', {
      routineId,
      latitude: region.latitude,
      longitude: region.longitude,
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
    console.error('[GeofenceTask] Failed to process arrival:', e);
  }
});
