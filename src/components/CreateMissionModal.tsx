import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Spacing, Typography } from "../constants";
import { useTheme } from "../context/ThemeContext";
import type { ColorScheme } from "../constants/colors";
import { createMission, updateMission } from "../api/missions";
import type { Mission } from "../types/Mission";
import { LocationService } from "../services/LocationService";
import { classifyDistance, haversineMeters } from "../config/tierConfig";
import ChooseOnMapModal from "./ChooseOnMapModal";
import MissionTypePicker from "./createMission/MissionTypePicker";
import LocationSearchField from "./createMission/LocationSearchField";
import MapLocationPreview from "./createMission/MapLocationPreview";
import TimeWindowPicker from "./createMission/TimeWindowPicker";
import XpRewardCard from "./createMission/XpRewardCard";
import AdvancedRadiusPicker from "./createMission/AdvancedRadiusPicker";
import {
  LOC_TYPES,
  isTargetTimeInPast,
  toBackendTargetTime,
  type TargetTimeState,
} from "./createMission/types";
import { useMissionAnchor } from "../hooks/useMissionAnchor";
import {
  useLocationSearch,
  type LocationResult,
} from "../hooks/useLocationSearch";

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void;
  // Edit mode: doluysa form bu mission'la pre-fill edilir, submit PATCH'e gider.
  editMission?: Mission | null;
  // Pin'in 50 m içine düşmemesi gereken aktif mission'lar. Edit mode'da
  // editMission listeden parent'ta filtrelenmeli.
  existingMissions?: Mission[];
};

const INITIAL_TIME_WINDOW: TargetTimeState = {
  enabled: false,
  hour: 12,
  minute: 0,
  use24h: false,
};

function makeStyles(C: ColorScheme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "flex-end",
    },
    sheet: {
      flex: 1,
      backgroundColor: C.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderTopWidth: 1,
      borderColor: C.borderBright,
      marginTop: 60,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
    },
    backButton: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.borderBright,
      alignItems: "center",
      justifyContent: "center",
    },
    fieldLabel: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 11,
      letterSpacing: 1.4,
      color: C.textSecondary,
      marginTop: Spacing.lg,
      marginBottom: Spacing.sm,
    },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: C.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.borderBright,
      paddingHorizontal: Spacing.md,
      height: 50,
      gap: 10,
    },
    input: {
      flex: 1,
      color: C.textPrimary,
      fontFamily: "Inter_400Regular",
      fontSize: 15,
      paddingVertical: 0,
    },
    submitButton: {
      height: 56,
      borderRadius: 18,
      backgroundColor: C.accent,
      alignItems: "center",
      justifyContent: "center",
      marginTop: Spacing.lg,
      shadowColor: C.accent,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.45,
      shadowRadius: 18,
      elevation: 8,
    },
  });
}

export default function CreateMissionModal({
  visible,
  onClose,
  onCreated,
  editMission,
  existingMissions = [],
}: Props) {
  const isEditMode = !!editMission;
  const { colors: C } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [loading, setLoading] = useState(false);
  const [missionName, setMissionName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState(LOC_TYPES[2]);
  const [timeWindow, setTimeWindow] =
    useState<TargetTimeState>(INITIAL_TIME_WINDOW);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [radiusMeters, setRadiusMeters] = useState(100);

  const { anchorCoords, anchorError, reset: resetAnchor } =
    useMissionAnchor(visible);
  const search = useLocationSearch();

  const tierPreview = useMemo(() => {
    if (!anchorCoords || locationLat == null || locationLng == null)
      return null;
    const distance = haversineMeters(
      anchorCoords.lat,
      anchorCoords.lng,
      locationLat,
      locationLng,
    );
    return { ...classifyDistance(distance), distanceMeters: distance };
  }, [anchorCoords, locationLat, locationLng]);

  const initialLocationForMap = useMemo(() => {
    if (locationLat && locationLng && locationName) {
      return { lat: locationLat, lng: locationLng, name: locationName };
    }
    return null;
  }, [locationLat, locationLng, locationName]);

  const resetForm = useCallback(() => {
    setMissionName("");
    setLocationName("");
    setLocationLat(null);
    setLocationLng(null);
    setSelectedType(LOC_TYPES[2]);
    setTimeWindow(INITIAL_TIME_WINDOW);
    setShowAdvanced(false);
    setRadiusMeters(100);
    search.reset();
    resetAnchor();
  }, [search, resetAnchor]);

  const handleSelectLocation = useCallback(
    (item: { name: string; lat: number; lng: number }) => {
      setLocationName(item.name);
      setLocationLat(item.lat);
      setLocationLng(item.lng);
      search.reset();
    },
    [search],
  );

  const clearLocation = useCallback(() => {
    setLocationName("");
    setLocationLat(null);
    setLocationLng(null);
    search.reset();
  }, [search]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Edit mode: modal her açıldığında form'u editMission verisinden doldur.
  // Modal kapatılırken handleClose → resetForm zaten temizliyor; değişiklik
  // gerektirmez. selectedType eşleşmezse "custom" tipine düşer (LOC_TYPES[4]).
  useEffect(() => {
    if (!visible || !editMission) return;
    setMissionName(editMission.missionName);
    setLocationName(editMission.locationName);
    setLocationLat(editMission.latitude);
    setLocationLng(editMission.longitude);
    setRadiusMeters(editMission.radiusMeters);
    const matchedType =
      LOC_TYPES.find((t) => t.iconType === editMission.iconType) ??
      LOC_TYPES[4];
    setSelectedType(matchedType);
  }, [visible, editMission]);

  // Yeni mission yaratıldıktan sonra geofence listesini güncelle. Helper
  // autoTrackingEnabled flag'ini ve permission'ı kendi içinde kontrol ediyor —
  // switch off ise OS dinlemesin diye no-op döner.
  const syncGeofences = () => LocationService.syncTodayGeofences();

  const handleSubmit = async () => {
    if (!missionName.trim()) return;
    if (!anchorCoords) {
      Alert.alert(
        t("createMission.locationRequiredTitle"),
        anchorError ?? t("createMission.gpsWaiting"),
      );
      return;
    }
    if (locationLat == null || locationLng == null) {
      Alert.alert(
        t("createMission.locationRequiredTitle"),
        t("createMission.locationMustBePicked"),
      );
      return;
    }
    if (
      timeWindow.enabled &&
      isTargetTimeInPast(timeWindow.hour, timeWindow.minute)
    ) {
      Alert.alert(
        t("createMission.timeInvalidTitle"),
        t("createMission.timeMustBeFuture"),
      );
      return;
    }

    const latitude = locationLat;
    const longitude = locationLng;

    setLoading(true);
    try {
      if (isEditMode && editMission) {
        await updateMission(editMission.id, {
          missionName: missionName.trim(),
          locationName: locationName.trim() || "Unknown Location",
          latitude,
          longitude,
          radiusMeters,
          iconType: selectedType.iconType,
          userLatitude: anchorCoords.lat,
          userLongitude: anchorCoords.lng,
        });
      } else {
        await createMission({
          missionName: missionName.trim(),
          locationName: locationName.trim() || "Unknown Location",
          latitude,
          longitude,
          radiusMeters,
          iconType: selectedType.iconType,
          anchorLatitude: anchorCoords.lat,
          anchorLongitude: anchorCoords.lng,
          tier: tierPreview?.tier ?? null,
          potentialXP: tierPreview?.potentialXP ?? null,
          userLatitude: anchorCoords.lat,
          userLongitude: anchorCoords.lng,
          targetTime: timeWindow.enabled
            ? toBackendTargetTime(timeWindow.hour, timeWindow.minute)
            : undefined,
        });
      }

      resetForm();
      onClose();
      await syncGeofences();
      onCreated?.();
    } catch (e: any) {
      Alert.alert(
        t("common.error"),
        e?.response?.data?.error ?? t("createMission.createFailedMsg"),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={handleClose}
      >
        <KeyboardAvoidingView style={styles.overlay} behavior="padding">
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
          <View style={styles.sheet}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                padding: Spacing.lg,
                paddingBottom: Spacing.xxl,
              }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.header}>
                <Pressable
                  style={styles.backButton}
                  onPress={handleClose}
                  hitSlop={8}
                >
                  <Ionicons
                    name="chevron-back"
                    size={20}
                    color={C.textPrimary}
                  />
                </Pressable>
                <View style={{ flex: 1, marginLeft: Spacing.md }}>
                  <Text
                    style={[Typography.displayLG, { color: C.textPrimary }]}
                  >
                    {isEditMode
                      ? t("createMission.editTitle")
                      : t("createMission.title")}
                  </Text>
                  <Text
                    style={[
                      Typography.body,
                      { color: C.textSecondary, marginTop: 2 },
                    ]}
                  >
                    {t("createMission.subtitle")}
                  </Text>
                </View>
              </View>

              <Text style={styles.fieldLabel}>{t("createMission.missionNameLabel")}</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="create-outline" size={16} color={C.accent} />
                <TextInput
                  style={styles.input}
                  placeholder={t("createMission.missionNamePlaceholder")}
                  placeholderTextColor={C.textSecondary}
                  value={missionName}
                  onChangeText={setMissionName}
                />
              </View>

              <Text style={styles.fieldLabel}>{t("createMission.locationTypeLabel")}</Text>
              <MissionTypePicker
                selected={selectedType}
                onSelect={setSelectedType}
              />

              <Text style={styles.fieldLabel}>{t("createMission.locationLabel")}</Text>
              <LocationSearchField
                selectedName={locationName}
                query={search.query}
                results={search.results}
                searching={search.searching}
                onQueryChange={search.onQueryChange}
                onSelectResult={handleSelectLocation as (i: LocationResult) => void}
                onClear={clearLocation}
              />
              <MapLocationPreview
                selectedName={locationName}
                onPress={() => setShowMapModal(true)}
              />

              {!isEditMode && (
                <>
                  <Text style={styles.fieldLabel}>
                    {t("createMission.targetTimeLabel")}
                  </Text>
                  <TimeWindowPicker
                    state={timeWindow}
                    onChange={setTimeWindow}
                  />
                </>
              )}

              <XpRewardCard
                tierPreview={tierPreview}
                anchorCoords={anchorCoords}
                anchorError={anchorError}
                punctualityEnabled={!isEditMode && timeWindow.enabled}
              />

              <AdvancedRadiusPicker
                expanded={showAdvanced}
                onToggle={() => setShowAdvanced((v) => !v)}
                radiusMeters={radiusMeters}
                onRadiusChange={setRadiusMeters}
              />

              <Pressable
                style={[
                  styles.submitButton,
                  (loading ||
                    !missionName.trim() ||
                    locationLat == null ||
                    locationLng == null) && { opacity: 0.5 },
                ]}
                onPress={handleSubmit}
                disabled={
                  loading ||
                  !missionName.trim() ||
                  locationLat == null ||
                  locationLng == null
                }
              >
                {loading ? (
                  <ActivityIndicator color={C.background} />
                ) : (
                  <Text style={[Typography.cta, { color: C.background }]}>
                    {isEditMode
                      ? t("createMission.saveButton")
                      : t("createMission.launchButton")}
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ChooseOnMapModal
        visible={showMapModal}
        onClose={() => setShowMapModal(false)}
        onConfirm={(loc) => handleSelectLocation(loc)}
        recentResults={search.results}
        initialLocation={initialLocationForMap}
        existingMissions={existingMissions}
      />
    </>
  );
}
