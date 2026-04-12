import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Routine } from '../types/Routine';

const STORAGE_KEY = 'itera_routines';

export async function loadRoutines(): Promise<Routine[]> {
  const json = await AsyncStorage.getItem(STORAGE_KEY);
  return json ? JSON.parse(json) : [];
}

export async function saveRoutines(routines: Routine[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(routines));
}

export async function addRoutine(routine: Routine): Promise<Routine[]> {
  const routines = await loadRoutines();
  routines.push(routine);
  await saveRoutines(routines);
  return routines;
}

export async function removeRoutine(id: string): Promise<Routine[]> {
  const routines = (await loadRoutines()).filter((r) => r.id !== id);
  await saveRoutines(routines);
  return routines;
}
