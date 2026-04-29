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
import { Colors, Spacing, Typography } from "../constants";
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

export default function CreateMissionModal({
  visible,
  onClose,
  onCreated,
}: Props) {
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
        "Location required",
        anchorError ??
          "Waiting for GPS to determine your position. Try again in a moment.",
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
        "Error",
        e?.response?.data?.error ?? "Failed to create mission.",
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
                    color={Colors.textPrimary}
                  />
                </Pressable>
                <View style={{ flex: 1, marginLeft: Spacing.md }}>
                  <Text
                    style={[Typography.displayLG, { color: Colors.textPrimary }]}
                  >
                    New Mission
                  </Text>
                  <Text
                    style={[
                      Typography.body,
                      { color: Colors.textSecondary, marginTop: 2 },
                    ]}
                  >
                    Set a routine at a real-world location
                  </Text>
                </View>
              </View>

              <Text style={styles.fieldLabel}>MISSION NAME</Text>
              <View style={styles.inputWrap}>
                <Ionicons
                  name="create-outline"
                  size={16}
                  color={Colors.accent}
                />
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Deep Work Block"
                  placeholderTextColor={Colors.textSecondary}
                  value={missionName}
                  onChangeText={setMissionName}
                />
              </View>

              <Text style={styles.fieldLabel}>LOCATION TYPE</Text>
              <MissionTypePicker
                selected={selectedType}
                onSelect={setSelectedType}
              />

              <Text style={styles.fieldLabel}>LOCATION</Text>
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

              <Text style={styles.fieldLabel}>TIME WINDOW</Text>
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
                  <ActivityIndicator color={Colors.background} />
                ) : (
                  <Text style={[Typography.cta, { color: Colors.background }]}>
                    LAUNCH MISSION →
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  sheet: {
    flex: 1,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: Colors.borderBright,
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
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldLabel: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 11,
    letterSpacing: 1.4,
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    paddingHorizontal: Spacing.md,
    height: 50,
    gap: 10,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
  submitButton: {
    height: 56,
    borderRadius: 18,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.lg,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
});
