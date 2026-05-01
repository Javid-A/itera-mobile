export interface Profile {
  username: string;
  currentLevel: number;
  currentXP: number;
  totalMissions: number;
  totalXP: number;
  currentStreak: number;
  longestStreak?: number;
}
