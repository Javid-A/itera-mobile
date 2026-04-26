export type MissionTier = 'A' | 'B' | 'C';

export type MissionStatus = 'pending' | 'completed' | 'missed';

export interface Mission {
  id: string;
  missionName: string;
  locationName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  iconType: string;
  tier: MissionTier;
  potentialXP: number;
  anchorDistanceMeters: number;
  scheduledDate: string; // ISO yyyy-mm-dd in user TZ
  status: MissionStatus;
  completedAt: string | null;
  earnedXP: number | null;
}
