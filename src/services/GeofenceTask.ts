import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { GeofencingEventType, type LocationRegion } from 'expo-location';
import { loadRoutines } from '../storage/routines';
import { addCompletedMission, isOnCooldown, setCooldown } from '../storage/history';
import { awardXP, XP_PER_MISSION } from '../storage/profile';

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

  // Idempotency: 1-hour cooldown per routine
  if (await isOnCooldown(routineId)) {
    console.log(`[GeofenceTask] Cooldown active for: ${routineId}`);
    return;
  }

  // Find routine details
  const routines = await loadRoutines();
  const routine = routines.find((r) => r.id === routineId);
  const missionName = routine?.missionName ?? 'Unknown Mission';

  // Log to history
  await addCompletedMission({
    id: Date.now().toString(),
    routineId,
    missionName,
    completedAt: new Date().toISOString(),
    xpEarned: XP_PER_MISSION,
  });

  // Award XP
  await awardXP();

  // Set cooldown
  await setCooldown(routineId);

  // Local notification
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Mission Complete!',
      body: `${missionName} — +${XP_PER_MISSION} XP`,
    },
    trigger: null,
  });

  console.log(`[GeofenceTask] Completed: ${missionName} +${XP_PER_MISSION} XP`);
});
