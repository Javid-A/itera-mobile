// 8b'de mutation'ların invalidate edeceği tek doğru nokta — query'ler ve mutation'lar
// aynı key referansını paylaşır, böylece typo ile cache desync'ı oluşmaz.
export const qk = {
  missionsToday: ["missions", "today"] as const,
  profile: ["profile"] as const,
  daySummary: ["missions", "day-summary"] as const,
  missionHistory: ["missions", "history"] as const,
};
