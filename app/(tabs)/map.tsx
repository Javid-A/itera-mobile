import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Colors, Spacing, Typography } from "../../src/constants";
import { deleteMission as deleteMissionRequest } from "../../src/api/missions";
import { useMissionsToday } from "../../src/state/queries/useMissionsToday";
import { useProfile } from "../../src/state/queries/useProfile";
import { qk } from "../../src/state/queryKeys";
import { requestBackgroundLocation } from "../../src/services/locationSettings";
import {
  MapboxAvailable,
  MapView,
  Camera,
  MarkerView,
} from "../../src/services/mapbox";
import CharacterSprite from "../../src/components/CharacterSprite";
import CreateMissionModal from "../../src/components/CreateMissionModal";
import TopHud from "../../src/components/map/TopHud";
import MissionBadge from "../../src/components/map/MissionBadge";
import XpToast from "../../src/components/map/XpToast";
import MapMissionsLayer from "../../src/components/map/MapMissionsLayer";
import CompletionRingLayer from "../../src/components/map/CompletionRingLayer";
import MissionsBottomSheet, {
  SHEET_HEIGHTS,
} from "../../src/components/map/MissionsBottomSheet";
import { useUserLocation } from "../../src/hooks/useUserLocation";
import { useBottomSheet } from "../../src/hooks/useBottomSheet";
import { useDayTick } from "../../src/hooks/useDayTick";
import { useBackgroundPermission } from "../../src/hooks/useBackgroundPermission";
import { useMissionArrival } from "../../src/hooks/useMissionArrival";
import type { Mission } from "../../src/types/Mission";

const MAP_PITCH = 65;
const MAP_ZOOM_DEFAULT = 17.5;
const MAP_ZOOM_MIN = 17.5;
const MAP_ZOOM_MAX = 20.5;
const CHARACTER_DISPLAY_SIZE = 88;
const CHARACTER_MAX_SCALE = 1.75;

// Horizon fog: pitch 65°'de Mapbox ufuk çizgisi ekranın ~%15'inde duruyor.
// LOD pop-in'i gizlemek için ince bir bant maskeliyoruz.
const SCREEN_HEIGHT = Dimensions.get("window").height;
const HORIZON_Y_RATIO = 0.15;
const FOG_BAND_PX = 0;
const FOG_TOP_PX = Math.max(
  0,
  SCREEN_HEIGHT * HORIZON_Y_RATIO - FOG_BAND_PX / 2,
);

export default function MapScreen() {
  const queryClient = useQueryClient();
  const { data: missionsData } = useMissionsToday();
  const { data: profileData } = useProfile();
  // Lokal missions state, useMissionArrival animasyonu sırasında server refetch'inin
  // 'completed' flag flip'ini ezmesini önler. Animasyon yokken server verisinden
  // senkronize edilir (aşağıdaki effect).
  const [missions, setMissions] = useState<Mission[]>([]);
  const profile = profileData ?? null;
  const [createVisible, setCreateVisible] = useState(false);

  // Karakter zoom-bazlı ölçeklendirme: pinch sırasında her frame setState
  // tetiklememek için native transform üzerinden Animated.Value ile sürüyoruz.
  // Translate, foot point'in 88px kutusunun altında sabit kalmasını sağlar.
  const characterScaleAnim = useRef(new Animated.Value(1)).current;
  const characterTranslateAnim = useRef(new Animated.Value(0)).current;

  const cameraRef = useRef<any>(null);
  const refreshMissionsRef = useRef<() => void>(() => {});

  const {
    granted: bgGranted,
    refresh: checkBg,
    setGranted: setBgGranted,
  } = useBackgroundPermission();
  const bgDenied = !bgGranted;

  const {
    userCoords,
    displayedCoords,
    userCoordsRef,
    isWalking,
    characterDirection,
    recenter,
    onCameraHeading,
  } = useUserLocation({
    cameraRef,
    onAppForeground: () => refreshMissionsRef.current(),
  });

  const refreshProfile = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: qk.profile });
    queryClient.invalidateQueries({ queryKey: qk.daySummary });
  }, [queryClient]);

  const {
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
  } = useMissionArrival({
    missions,
    setMissions,
    userCoords,
    userCoordsRef,
    onProfileRefresh: refreshProfile,
  });

  const completingMission = useMemo(
    () => missions.find((m) => m.id === completingMissionId) ?? null,
    [missions, completingMissionId],
  );

  const {
    sheetY,
    isExpanded: isSheetExpanded,
    snap: snapSheet,
    panHandlers: sheetPanHandlers,
    backdropOpacity,
  } = useBottomSheet({
    collapsedHeight: SHEET_HEIGHTS.collapsed,
    expandedHeight: SHEET_HEIGHTS.expanded,
  });

  const flyToMission = useCallback(
    (mission: Mission) => {
      cameraRef.current?.setCamera({
        centerCoordinate: [mission.longitude, mission.latitude],
        zoomLevel: MAP_ZOOM_DEFAULT,
        pitch: MAP_PITCH,
        animationDuration: 600,
      });
      snapSheet(false);
    },
    [snapSheet],
  );

  const refreshMissions = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: qk.missionsToday });
  }, [queryClient]);

  // Server verisi → lokal state senkronu. Arrival animasyonu sırasında ezmemek için
  // completingMissionId yokken kopyalıyoruz; animasyon biter bitmez (markCompleted
  // sonrası) bir sonraki refetch'te doğal akışla senkronize olur.
  //
  // Lokal olarak "completed" işaretlenmiş mission'ları koruyoruz: animasyon bitip
  // completingMissionId null'a döndüğünde server cache henüz güncel olmayabilir.
  // Stale data "active" yazarsa prevActiveMissionId sıfırlanıp arrival loop'a girer.
  useEffect(() => {
    if (missionsData && !completingMissionId) {
      setMissions((prev) => {
        const locallyCompletedIds = new Set(
          prev.filter((m) => m.status === "completed").map((m) => m.id),
        );
        if (locallyCompletedIds.size === 0) return missionsData;
        return missionsData.map((m) =>
          locallyCompletedIds.has(m.id)
            ? { ...m, status: "completed" as const }
            : m,
        );
      });
    }
  }, [missionsData, completingMissionId]);

  const deleteMission = useCallback(
    (id: string) => {
      setMissions((prev) => prev.filter((m) => m.id !== id));
      deleteMissionRequest(id).catch(() => refreshMissions());
    },
    [refreshMissions],
  );

  useEffect(() => {
    refreshMissionsRef.current = refreshMissions;
  }, [refreshMissions]);

  useFocusEffect(
    useCallback(() => {
      refreshMissions();
      refreshProfile();
      checkBg();
    }, [checkBg, refreshMissions, refreshProfile]),
  );

  // App açık kaldığı sırada gece yarısı geçerse missionları yenile.
  useDayTick(refreshMissions);

  const handleBannerPress = useCallback(async () => {
    const granted = await requestBackgroundLocation();
    if (granted) setBgGranted(true);
  }, [setBgGranted]);

  const handleCameraChanged = useCallback(
    (state: any) => {
      onCameraHeading(state.properties.heading ?? 0);
      // Karakter zoom'a göre büyür: 1.0x @ MAP_ZOOM_MIN → MAX @ MAP_ZOOM_MAX.
      const zoom = state.properties.zoom ?? MAP_ZOOM_MIN;
      const zoomT = Math.max(
        0,
        Math.min(1, (zoom - MAP_ZOOM_MIN) / (MAP_ZOOM_MAX - MAP_ZOOM_MIN)),
      );
      const nextScale = 1 + zoomT * (CHARACTER_MAX_SCALE - 1);
      characterScaleAnim.setValue(nextScale);
      characterTranslateAnim.setValue(
        (-CHARACTER_DISPLAY_SIZE * (nextScale - 1)) / 2,
      );
    },
    [onCameraHeading, characterScaleAnim, characterTranslateAnim],
  );

  if (!MapboxAvailable) {
    return (
      <View style={styles.fallback}>
        <Text style={[Typography.displayMD, { color: Colors.textPrimary }]}>
          Map
        </Text>
        <Text
          style={[
            Typography.caption,
            { color: Colors.textSecondary, marginTop: 8 },
          ]}
        >
          Mapbox requires a development build.
        </Text>
        <Text style={[Typography.caption, { color: Colors.textSecondary }]}>
          Run: npx expo run:ios or npx expo run:android
        </Text>
      </View>
    );
  }

  const characterCoord = displayedCoords ?? userCoords;

  return (
    <View style={styles.map}>
      <MapView
        style={styles.map}
        styleURL="mapbox://styles/javid-a/cmnywehfe001101qz3nmtgtsa" // day
        // styleURL="mapbox://styles/javid-a/cmod7nmgy001301r6dqrp2luq" // night
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
        pitchEnabled={true}
        rotateEnabled={true}
        onCameraChanged={handleCameraChanged}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [13.405, 52.52],
            zoomLevel: MAP_ZOOM_DEFAULT,
            pitch: MAP_PITCH,
            heading: 0,
          }}
          minZoomLevel={2}
          maxZoomLevel={MAP_ZOOM_MAX}
        />

        <MapMissionsLayer
          missions={missions}
          completingMissionId={completingMissionId}
        />

        {completingMission && (
          <CompletionRingLayer
            mission={completingMission}
            scale={completionScale}
            isGreen={completionIsGreen}
          />
        )}

        {characterCoord && (
          <MarkerView
            coordinate={characterCoord as [number, number]}
            anchor={{ x: 0.5, y: 0.85 }}
            allowOverlap
          >
            <View collapsable={false} pointerEvents="none">
              <Animated.View
                style={{
                  transform: [
                    { translateY: characterTranslateAnim },
                    { scale: characterScaleAnim },
                  ],
                }}
              >
                <CharacterSprite
                  isWalking={isWalking}
                  direction={characterDirection}
                  displaySize={CHARACTER_DISPLAY_SIZE}
                />
              </Animated.View>
            </View>
          </MarkerView>
        )}
      </MapView>

      <LinearGradient
        pointerEvents="none"
        colors={[
          "rgba(8, 10, 20, 0)",
          "rgba(14, 18, 32, 0.85)",
          "rgba(20, 26, 42, 0.9)",
          "rgba(14, 18, 32, 0.55)",
          "rgba(8, 10, 20, 0)",
        ]}
        locations={[0, 0.35, 0.5, 0.7, 1]}
        style={styles.horizonFog}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.vignetteBorder,
          { opacity: vignetteAnim, borderColor: Colors.orange },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.vignetteGlow,
          { opacity: vignetteAnim, borderColor: "rgba(249, 115, 22, 0.25)" },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.vignetteBorder,
          { opacity: greenVignetteAnim, borderColor: Colors.success },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.vignetteGlow,
          {
            opacity: greenVignetteAnim,
            borderColor: "rgba(34, 197, 94, 0.25)",
          },
        ]}
      />

      <TopHud
        profile={profile}
        missions={missions}
        bgDenied={bgDenied}
        onFixBackground={handleBannerPress}
      />

      {activeMission && !completingMissionId && (
        <MissionBadge
          missionName={activeMission.missionName}
          opacity={vignetteAnim}
        />
      )}

      <XpToast
        xp={completionXP}
        streakBonusXP={completionStreakBonus}
        opacity={xpToastOpacity}
        translateY={xpToastTranslate}
      />

      <View
        style={styles.recenterButtonWrapper}
        pointerEvents={isSheetExpanded ? "none" : "auto"}
      >
        <Pressable style={styles.recenterButton} onPress={recenter} hitSlop={8}>
          <Ionicons name="locate" size={22} color={Colors.textPrimary} />
        </Pressable>
      </View>

      <View
        style={styles.fabWrapper}
        pointerEvents={isSheetExpanded ? "none" : "auto"}
      >
        <Pressable
          style={styles.fab}
          onPress={() => setCreateVisible(true)}
          hitSlop={8}
        >
          <Ionicons name="add" size={26} color={Colors.background} />
        </Pressable>
      </View>

      <MissionsBottomSheet
        missions={missions}
        sheetY={sheetY}
        isExpanded={isSheetExpanded}
        panHandlers={sheetPanHandlers}
        backdropOpacity={backdropOpacity}
        onCollapse={() => snapSheet(false)}
        onMissionPress={flyToMission}
        onMissionDelete={deleteMission}
      />

      <CreateMissionModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onCreated={refreshMissions}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  fallback: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  recenterButtonWrapper: {
    position: "absolute",
    right: 0,
    bottom: 0,
    zIndex: 15,
    elevation: 15,
  },
  recenterButton: {
    position: "absolute",
    right: Spacing.md,
    bottom: SHEET_HEIGHTS.collapsed + Spacing.md + 64,
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "rgba(11, 14, 26, 0.9)",
    borderWidth: 1,
    borderColor: Colors.borderBright,
    alignItems: "center",
    justifyContent: "center",
  },
  fabWrapper: {
    position: "absolute",
    right: 0,
    bottom: 0,
    zIndex: 15,
    elevation: 15,
  },
  fab: {
    position: "absolute",
    right: Spacing.md,
    bottom: SHEET_HEIGHTS.collapsed + Spacing.md,
    width: 54,
    height: 54,
    borderRadius: 17,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  horizonFog: {
    position: "absolute",
    top: FOG_TOP_PX,
    left: 0,
    right: 0,
    height: FOG_BAND_PX,
    zIndex: 5,
  },
  vignetteBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 3,
  },
  vignetteGlow: {
    position: "absolute",
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderWidth: 24,
  },
});
