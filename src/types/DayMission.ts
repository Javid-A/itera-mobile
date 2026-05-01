import type { MissionTier } from './Mission';

export interface DayMission {
  id: string;
  missionName: string;
  locationName: string;
  iconType: string;
  tier: MissionTier;
  latitude: number;
  longitude: number;
  status: 'completed' | 'pending' | 'missed';
  completedAt?: string;
  earnedXP?: number;
  potentialXP?: number;
}
