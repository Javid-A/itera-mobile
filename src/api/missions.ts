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
}

export async function getMissionsToday(): Promise<Mission[]> {
  const { data } = await apiClient.get<Mission[]>('/missions/today');
  return data;
}

export async function createMission(payload: CreateMissionPayload): Promise<void> {
  await apiClient.post('/missions', payload);
}

export async function deleteMission(id: string): Promise<void> {
  await apiClient.delete(`/missions/${id}`);
}

export async function arriveMission(payload: ArrivePayload): Promise<ArriveResponse> {
  const { data } = await apiClient.post<ArriveResponse>('/missions/arrive', payload);
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
