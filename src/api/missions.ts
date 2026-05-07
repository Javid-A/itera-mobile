import apiClient from '../services/apiClient';
import type { Mission, MissionTier } from '../types/Mission';
import type { DaySummaryResponse } from '../types/DaySummary';
import type { HistoryItem } from '../types/HistoryItem';

export interface CreateMissionPayload {
  missionName: string;
  locationName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  iconType: string;
  anchorLatitude: number;
  anchorLongitude: number;
  tier: MissionTier | null;
  potentialXP: number | null;
  // Backend exclusion zone (50 m) ve armed (100 m) hesabı için kullanır.
  userLatitude: number;
  userLongitude: number;
  // Punctuality bonus için hedef saat — "HH:mm:ss" (TimeOnly). Opsiyonel.
  // Set edildiğinde arrival ±30 dk içindeyse +50 XP. Immutable (PATCH yok).
  targetTime?: string;
}

export interface UpdateMissionPayload {
  missionName?: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  iconType?: string;
  // Konum değiştirilirse backend exclusion zone + armed yeniden hesaplar.
  userLatitude?: number;
  userLongitude?: number;
}

export interface ArrivePayload {
  missionId: string;
  latitude: number;
  longitude: number;
}

export interface ArriveResponse {
  earnedXP: number;
  missionName: string;
  cooldownActive?: boolean;
  leveledUp?: boolean;
  currentLevel?: number;
  streakDays?: number;
  streakBonusXP?: number;
  streakIncreased?: boolean;
  punctualityBonusXP?: number;
}

export async function getMissionsToday(): Promise<Mission[]> {
  const { data } = await apiClient.get<Mission[]>('/missions/today');
  return data;
}

export async function createMission(payload: CreateMissionPayload): Promise<void> {
  await apiClient.post('/missions', payload);
}

export async function updateMission(
  id: string,
  payload: UpdateMissionPayload,
): Promise<Mission> {
  const { data } = await apiClient.patch<Mission>(`/missions/${id}`, payload);
  return data;
}

export async function arriveMission(payload: ArrivePayload): Promise<ArriveResponse> {
  const { data } = await apiClient.post<ArriveResponse>('/missions/arrive', payload);
  return data;
}

// Backend distance >= 100m kontrolü yapar; <100m ise MISSION_ARM_TOO_CLOSE 400.
// Mobile arm tetiklemeden önce mesafeyi kontrol ettiği için 400 sadece edge
// case'lerde (race) olur — caller catch'te yutar.
export async function armMission(id: string): Promise<Mission> {
  const { data } = await apiClient.post<Mission>(`/missions/${id}/arm`, {});
  return data;
}

export async function getMissionHistory(): Promise<HistoryItem[]> {
  const { data } = await apiClient.get<HistoryItem[]>('/missions/history');
  return data;
}

export async function getDaySummary(): Promise<DaySummaryResponse> {
  const { data } = await apiClient.get<DaySummaryResponse>('/missions/day-summary');
  return data;
}
