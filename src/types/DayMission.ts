export interface DayMission {
  id: string;
  missionName: string;
  locationName: string;
  latitude: number;
  longitude: number;
  status: 'completed' | 'pending' | 'missed';
  completedAt?: string;
  earnedXP?: number;
  potentialXP?: number;
}
