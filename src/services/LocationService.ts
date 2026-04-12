import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { GEOFENCE_TASK_NAME } from './GeofenceTask';

export interface GeofenceRegion {
  id: string;
  latitude: number;
  longitude: number;
  radius: number;
}

async function hasPermissions(): Promise<boolean> {
  const fg = await Location.getForegroundPermissionsAsync();
  const bg = await Location.getBackgroundPermissionsAsync();
  return fg.status === 'granted' && bg.status === 'granted';
}

async function requestPermissions(): Promise<boolean> {
  if (await hasPermissions()) return true;

  const { status: foreground } = await Location.requestForegroundPermissionsAsync();
  if (foreground !== 'granted') {
    console.warn('[LocationService] Foreground permission denied');
    return false;
  }

  const { status: background } = await Location.requestBackgroundPermissionsAsync();
  if (background !== 'granted') {
    console.warn('[LocationService] Background permission denied');
    return false;
  }

  return true;
}

async function registerGeofences(regions: GeofenceRegion[]): Promise<void> {
  const isRunning = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK_NAME);
  if (isRunning) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
  }

  const locationRegions = regions.map((r) => ({
    identifier: r.id,
    latitude: r.latitude,
    longitude: r.longitude,
    radius: r.radius,
    notifyOnEnter: true,
    notifyOnExit: false,
  }));

  await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, locationRegions);
  console.log(`[LocationService] Registered ${regions.length} geofence(s)`);
}

async function stopGeofences(): Promise<void> {
  const isRunning = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK_NAME);
  if (isRunning) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
  }
}

export const LocationService = {
  requestPermissions,
  registerGeofences,
  stopGeofences,
};
