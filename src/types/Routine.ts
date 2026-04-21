export type MissionTier = 'A' | 'B' | 'C';

export interface Routine {
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
}
