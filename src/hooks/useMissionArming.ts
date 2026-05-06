import { useCallback, useEffect, useRef, useState } from "react";
import { Animated } from "react-native";
import { armMission } from "../api/missions";
import { haversineMeters } from "../utils/geo";
import { MISSION_ARM_DISTANCE_M } from "../config/gameConfig";
import { LocationService } from "../services/LocationService";
import type { Mission } from "../types/Mission";

interface Args {
  missions: Mission[];
  setMissions: React.Dispatch<React.SetStateAction<Mission[]>>;
  userCoords: [number, number] | null;
}

// Toast pencereleme: birden fazla mission peş peşe arm olursa tek bir toplu
// toast göstermek için ardışık başarıları küçük bir window içinde topluyoruz.
const TOAST_BATCH_MS = 700;

// Foreground'da, kullanıcı pin'in 100 m dışına çıktığında armed=false
// mission'ları "arm" eder. Backend POST /missions/{id}/arm endpoint'ini
// idempotent çağırırız (race / yarım kalan request durumlarında zarar yok).
//
// Background (GeofenceTask) tarafında arm tetiklemiyoruz: uyuyan pin için
// geofence kurulu değil (LocationService.syncTodayGeofences armed=true
// filtreliyor), kullanıcı app'i tekrar açtığında bu hook devreye girip
// sessizce yetişir.
export function useMissionArming({
  missions,
  setMissions,
  userCoords,
}: Args) {
  const armToastOpacity = useRef(new Animated.Value(0)).current;
  const armToastTranslate = useRef(new Animated.Value(0)).current;
  const [armToastCount, setArmToastCount] = useState(0);

  const inFlightRef = useRef<Set<string>>(new Set());
  const failedRef = useRef<Set<string>>(new Set());
  const pendingCountRef = useRef(0);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushToast = useCallback(() => {
    const count = pendingCountRef.current;
    pendingCountRef.current = 0;
    flushTimerRef.current = null;
    if (count <= 0) return;

    setArmToastCount(count);
    // Yeni armed mission(lar) için OS geofence kaydı: auto-tracking açıksa
    // bg path'i bu mission(ları) yakalayabilsin. Sessizce başarısız olur.
    LocationService.syncTodayGeofences().catch(() => {});
    armToastTranslate.setValue(0);
    armToastOpacity.setValue(1);

    Animated.parallel([
      Animated.timing(armToastTranslate, {
        toValue: -60,
        duration: 1800,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(900),
        Animated.timing(armToastOpacity, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [armToastOpacity, armToastTranslate]);

  const scheduleToast = useCallback(() => {
    pendingCountRef.current += 1;
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(flushToast, TOAST_BATCH_MS);
  }, [flushToast]);

  const armOne = useCallback(
    async (mission: Mission) => {
      if (inFlightRef.current.has(mission.id)) return;
      inFlightRef.current.add(mission.id);
      // Optimistik: backend yanıtını beklemeden lokal state'i çevir; geofence
      // sync ve UI gating hemen reaktif olsun. Hata olursa geri al.
      setMissions((prev) =>
        prev.map((m) => (m.id === mission.id ? { ...m, armed: true } : m)),
      );
      try {
        await armMission(mission.id);
        scheduleToast();
      } catch {
        // Rollback + bu mission'ı bu oturum için kara listeye al. Aksi halde
        // useEffect missions değişikliğini görüp aynı isteği sonsuz döngüde
        // tekrar gönderir (kullanıcı hâlâ 100m dışında olduğu için).
        failedRef.current.add(mission.id);
        setMissions((prev) =>
          prev.map((m) => (m.id === mission.id ? { ...m, armed: false } : m)),
        );
      } finally {
        inFlightRef.current.delete(mission.id);
      }
    },
    [setMissions, scheduleToast],
  );

  useEffect(() => {
    if (!userCoords) return;
    for (const m of missions) {
      if (m.status === "completed") continue;
      if (m.armed) continue;
      if (inFlightRef.current.has(m.id)) continue;
      if (failedRef.current.has(m.id)) continue;
      const dist = haversineMeters(
        userCoords[1],
        userCoords[0],
        m.latitude,
        m.longitude,
      );
      if (dist >= MISSION_ARM_DISTANCE_M) {
        armOne(m);
      }
    }
  }, [userCoords, missions, armOne]);

  useEffect(() => {
    return () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    };
  }, []);

  return {
    armToastOpacity,
    armToastTranslate,
    armToastCount,
  };
}
