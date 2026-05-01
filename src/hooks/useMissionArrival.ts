import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated } from "react-native";
import { arriveMission } from "../api/missions";
import { haversineMeters } from "../utils/geo";
import type { Mission } from "../types/Mission";

interface Args {
  missions: Mission[];
  setMissions: React.Dispatch<React.SetStateAction<Mission[]>>;
  userCoords: [number, number] | null;
  userCoordsRef: React.MutableRefObject<[number, number] | null>;
  // Arrival animasyonu bittiğinde HUD XP/level senkronizasyonu için.
  onProfileRefresh: () => void;
}

// Mission'a girince çalışan tüm akışı kapsüller:
//   1. activeMission'ı kullanıcı konumundan tespit eder
//   2. Aktifken turuncu vignette pulse animasyonu
//   3. Yeni active mission yakaladığında arrive POST + halka kapanma + yeşil ring
//      + XP toast + halka tekrar genişleme animasyonu
//   4. Server cooldown (background task öne geçtiyse) durumunda kibar fallback
//
// map.tsx sadece sonuç state/animasyon değerlerini render etmek için tüketir.
export function useMissionArrival({
  missions,
  setMissions,
  userCoords,
  userCoordsRef,
  onProfileRefresh,
}: Args) {
  const [completingMissionId, setCompletingMissionId] = useState<string | null>(
    null,
  );
  const [completionXP, setCompletionXP] = useState(0);
  const [completionStreakBonus, setCompletionStreakBonus] = useState(0);
  const [completionIsGreen, setCompletionIsGreen] = useState(false);
  const [completionScale, setCompletionScale] = useState(1);

  const completionRadiusAnim = useRef(new Animated.Value(1)).current;
  const greenVignetteAnim = useRef(new Animated.Value(0)).current;
  const xpToastTranslate = useRef(new Animated.Value(0)).current;
  const xpToastOpacity = useRef(new Animated.Value(0)).current;
  const vignetteAnim = useRef(new Animated.Value(0)).current;

  const isCompletingRef = useRef(false);
  const prevActiveMissionIdRef = useRef<string | null>(null);
  const missionsRef = useRef<Mission[]>([]);

  useEffect(() => {
    missionsRef.current = missions;
  }, [missions]);

  // Animated.Value değerini state'e bağla; CompletionRingLayer her tick'te
  // yeni geoJSON üretsin diye gerek var (FillExtrusion shape prop'u native
  // driver kabul etmiyor).
  useEffect(() => {
    const id = completionRadiusAnim.addListener(({ value }) => {
      setCompletionScale(value);
    });
    return () => completionRadiusAnim.removeListener(id);
  }, [completionRadiusAnim]);

  const markMissionCompleted = useCallback(
    (id: string) => {
      setMissions((prev) =>
        prev.map((m) =>
          m.id === id
            ? {
                ...m,
                status: "completed",
                completedAt: m.completedAt ?? new Date().toISOString(),
              }
            : m,
        ),
      );
    },
    [setMissions],
  );

  const activeMission = useMemo(() => {
    if (!userCoords) return null;
    return (
      missions.find(
        (m) =>
          m.status !== "completed" &&
          haversineMeters(
            userCoords[1],
            userCoords[0],
            m.latitude,
            m.longitude,
          ) < m.radiusMeters,
      ) ?? null
    );
  }, [userCoords, missions]);

  // Aktif mission varken turuncu vignette nabız atışı; bittiğinde söner.
  useEffect(() => {
    if (!activeMission || activeMission.id === completingMissionId) {
      vignetteAnim.stopAnimation();
      Animated.timing(vignetteAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(vignetteAnim, {
          toValue: 0.85,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(vignetteAnim, {
          toValue: 0.4,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();

    return () => {
      loop.stop();
      Animated.timing(vignetteAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    };
  }, [activeMission?.id, completingMissionId, vignetteAnim]);

  const handleForegroundArrival = useCallback(
    async (mission: Mission, coords: [number, number]) => {
      if (isCompletingRef.current) return;
      isCompletingRef.current = true;

      setCompletingMissionId(mission.id);
      setCompletionIsGreen(false);
      completionRadiusAnim.setValue(1);

      const [, apiResult] = await Promise.all([
        new Promise<void>((resolve) => {
          Animated.timing(completionRadiusAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: false,
          }).start(() => resolve());
        }),
        arriveMission({
          missionId: mission.id,
          latitude: coords[1],
          longitude: coords[0],
        }).catch(() => null),
      ]);

      // Background GeofenceTask cooldown sırasında POST'u atmış olabilir veya
      // istek geçici olarak başarısız olmuş olabilir. Her iki durumda da turuncu
      // halkayı kapanmış bırakıyoruz ve pin'i "completed" yapıyoruz; aksi
      // halde halka geri açılır ve mission ancak reload sonrası tamamlanmış görünür.
      if (!apiResult || apiResult.cooldownActive) {
        markMissionCompleted(mission.id);
        setCompletingMissionId(null);
        isCompletingRef.current = false;
        onProfileRefresh();
        return;
      }

      const earnedXP = apiResult.earnedXP ?? 0;
      setCompletionXP(earnedXP);
      setCompletionStreakBonus(apiResult.streakBonusXP ?? 0);

      setCompletionIsGreen(true);
      completionRadiusAnim.setValue(0);

      Animated.parallel([
        Animated.timing(completionRadiusAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: false,
        }),
        Animated.timing(greenVignetteAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();

      xpToastTranslate.setValue(0);
      xpToastOpacity.setValue(1);
      Animated.parallel([
        Animated.timing(xpToastTranslate, {
          toValue: -80,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(600),
          Animated.timing(xpToastOpacity, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      await new Promise<void>((resolve) => setTimeout(resolve, 2500));

      await new Promise<void>((resolve) => {
        Animated.parallel([
          Animated.timing(greenVignetteAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(completionRadiusAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: false,
          }),
        ]).start(() => resolve());
      });

      markMissionCompleted(mission.id);
      setCompletingMissionId(null);
      isCompletingRef.current = false;

      onProfileRefresh();
    },
    [
      completionRadiusAnim,
      greenVignetteAnim,
      xpToastTranslate,
      xpToastOpacity,
      markMissionCompleted,
      onProfileRefresh,
    ],
  );

  // Yeni bir aktif mission tespit edildiğinde arrival flow'unu tetikle.
  useEffect(() => {
    const newId = activeMission?.id ?? null;
    const prevId = prevActiveMissionIdRef.current;

    const target = newId
      ? missionsRef.current.find((m) => m.id === newId)
      : null;
    if (
      newId !== null &&
      newId !== prevId &&
      target &&
      target.status !== "completed" &&
      !isCompletingRef.current
    ) {
      const coords = userCoordsRef.current;
      if (coords) {
        handleForegroundArrival(target, coords);
      }
    }

    prevActiveMissionIdRef.current = newId;
  }, [activeMission?.id, missions, handleForegroundArrival, userCoordsRef]);

  return {
    activeMission,
    completingMissionId,
    completionXP,
    completionStreakBonus,
    completionIsGreen,
    completionScale,
    vignetteAnim,
    greenVignetteAnim,
    xpToastTranslate,
    xpToastOpacity,
  };
}
