export const XP_PER_LEVEL = 1000;

export const STREAK_BONUS_TIERS = [
  { minDays: 30, bonusXP: 100 },
  { minDays: 7, bonusXP: 50 },
  { minDays: 3, bonusXP: 20 },
] as const;

export const STORAGE_KEYS = {
  autoTrackingEnabled: 'autoTrackingEnabled',
  missionCreatedCount: 'itera_mission_created_count',
} as const;

// Görev oluşturma sayısı bu değerlere ulaşınca background-permission prompt'u
// gösterilir (kullanıcıyı erkenden değil, kademeli olarak ikna etmek için).
// Bg izni zaten verilmişse atlanır; counter hep artar.
export const BG_PROMPT_TRIGGER_COUNTS = [1, 3, 7] as const;
