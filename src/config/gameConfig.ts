export const XP_PER_LEVEL = 1000;

export const STREAK_BONUS_TIERS = [
  { minDays: 30, bonusXP: 100 },
  { minDays: 7, bonusXP: 50 },
  { minDays: 3, bonusXP: 20 },
] as const;

export const STORAGE_KEYS = {
  autoTrackingEnabled: 'autoTrackingEnabled',
  missionCreatedCount: 'itera_mission_created_count',
  pendingLevelUp: 'itera_pending_level_up',
} as const;

// Görev oluşturma sayısı bu değerlere ulaşınca background-permission prompt'u
// gösterilir (kullanıcıyı erkenden değil, kademeli olarak ikna etmek için).
// Bg izni zaten verilmişse atlanır; counter hep artar.
export const BG_PROMPT_TRIGGER_COUNTS = [1, 3, 7] as const;

// Yeni mission'ın diğer aktif mission'lara minimum mesafesi. Aynı noktaya
// yığın mission koyup XP farming'i engellemek için.
export const MISSION_EXCLUSION_ZONE_M = 50;

// Oluşturma anında kullanıcının pin'e mesafesi bu eşiğin altındaysa mission
// armed=false başlar; tamamlanması için kullanıcının önce uzaklaşıp dönmesi
// gerekir. Mission radius'undan bağımsız sabit.
export const MISSION_ARM_DISTANCE_M = 100;
