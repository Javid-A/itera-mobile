import * as TaskManager from 'expo-task-manager';
import { GeofencingEventType, type LocationRegion } from 'expo-location';

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

  if (eventType === GeofencingEventType.Enter) {
    console.log(`[GeofenceTask] Entered region: ${region.identifier}`);
    // TODO: Replace with XP award and history persistence logic
  }
});
