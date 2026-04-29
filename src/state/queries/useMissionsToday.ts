import { useQuery } from "@tanstack/react-query";
import { getMissionsToday } from "../../api/missions";
import { classifyDistance } from "../../config/tierConfig";
import { qk } from "../queryKeys";
import type { Mission } from "../../types/Mission";

// Sunucudan gelen tier bilgisi yerine client-side classifyDistance kullanılıyor —
// TIER_TEST_SCALE ile lokal kalibrasyon değişikliklerinde anında geçerli olsun.
export function useMissionsToday() {
  return useQuery<Mission[]>({
    queryKey: qk.missionsToday,
    queryFn: async () => {
      const data = await getMissionsToday();
      return data.map((m) => {
        const tierInfo = classifyDistance(m.anchorDistanceMeters);
        return {
          ...m,
          tier: tierInfo.tier,
          potentialXP: tierInfo.potentialXP,
        };
      });
    },
  });
}
