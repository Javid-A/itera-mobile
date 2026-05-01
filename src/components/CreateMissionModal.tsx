import { useCallback, useMemo, useState } from "react";
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
import { createMission, getMissionsToday } from "../api/missions";
import { LocationService } from "../services/LocationService";
import { classifyDistance, haversineMeters } from "../config/tierConfig";
import ChooseOnMapModal from "./ChooseOnMapModal";
import MissionTypePicker from "./createMission/MissionTypePicker";
import LocationSearchField from "./createMission/LocationSearchField";
import MapLocationPreview from "./createMission/MapLocationPreview";
import TimeWindowPicker from "./createMission/TimeWindowPicker";
import XpRewardCard from "./createMission/XpRewardCard";
import AdvancedRadiusPicker from "./createMission/AdvancedRadiusPicker";
import { LOC_TYPES, type TimeWindowState } from "./createMission/types";
import { useMissionAnchor } from "../hooks/useMissionAnchor";
import {
  useLocationSearch,
  type LocationResult,
} from "../hooks/useLocationSearch";

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

const INITIAL_TIME_WINDOW: TimeWindowState = {
  enabled: false,
  fromHour: 8,
  fromMinute: 0,
  fromAmPm: "AM",
  toHour: 12,
  toMinute: 0,
  toAmPm: "PM",
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
}: Props) {
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
    useState<TimeWindowState>(INITIAL_TIME_WINDOW);
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

  const syncGeofences = async () => {
    try {
      const data = await getMissionsToday();
      const granted = await LocationService.requestPermissions();
      if (granted && data.length > 0) {
        await LocationService.registerGeofences(
          data.map((m) => ({
            id: m.id,
            latitude: m.latitude,
            longitude: m.longitude,
            radius: m.radiusMeters,
          })),
        );
      }
    } catch {}
  };

  const handleSubmit = async () => {
    if (!missionName.trim()) return;
    if (!anchorCoords) {
      Alert.alert(
        t("createMission.locationRequiredTitle"),
        anchorError ?? t("createMission.gpsWaiting"),
      );
      return;
    }

    const latitude = locationLat ?? 52.52 + (Math.random() - 0.5) * 0.01;
    const longitude = locationLng ?? 13.405 + (Math.random() - 0.5) * 0.01;

    setLoading(true);
    try {
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
      });

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
                    {t("createMission.title")}
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

              <Text style={styles.fieldLabel}>{t("createMission.timeWindowLabel")}</Text>
              <TimeWindowPicker
                state={timeWindow}
                onChange={setTimeWindow}
              />

              <XpRewardCard
                tierPreview={tierPreview}
                anchorCoords={anchorCoords}
                anchorError={anchorError}
              />

              <AdvancedRadiusPicker
                expanded={showAdvanced}
                onToggle={() => setShowAdvanced((v) => !v)}
                radiusMeters={radiusMeters}
                onRadiusChange={setRadiusMeters}
              />

              <Pressable
                style={[styles.submitButton, loading && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={C.background} />
                ) : (
                  <Text style={[Typography.cta, { color: C.background }]}>
                    {t("createMission.launchButton")}
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
      />
    </>
  );
}
