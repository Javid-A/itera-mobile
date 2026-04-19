import { useCallback, useRef, useState } from 'react';
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
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Typography } from '../constants';
import apiClient from '../src/services/apiClient';
import { LocationService } from '../src/services/LocationService';
import type { Routine } from '../src/types/Routine';
import BackgroundLocationPrompt from './BackgroundLocationPrompt';

const ICON_OPTIONS = [
  { key: 'briefcase', name: 'briefcase-outline' as const },
  { key: 'barbell', name: 'barbell-outline' as const },
  { key: 'cafe', name: 'cafe-outline' as const },
  { key: 'star', name: 'star-outline' as const },
  { key: 'home', name: 'home-outline' as const },
  { key: 'school', name: 'school-outline' as const },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

export default function CreateRoutineModal({ visible, onClose, onCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [missionName, setMissionName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [locationEditing, setLocationEditing] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState<{ id: string; name: string; lat: number; lng: number }[]>([]);
  const [locationSearching, setLocationSearching] = useState(false);
  const [radius, setRadius] = useState(100);
  const [selectedIcon, setSelectedIcon] = useState('briefcase');
  const [showBgPrompt, setShowBgPrompt] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetForm = useCallback(() => {
    setMissionName('');
    setLocationName('');
    setLocationLat(null);
    setLocationLng(null);
    setLocationEditing(false);
    setLocationQuery('');
    setLocationResults([]);
    setRadius(100);
    setSelectedIcon('briefcase');
    setAdvancedOpen(false);
  }, []);

  const handleLocationQueryChange = (query: string) => {
    setLocationQuery(query);
    setLocationResults([]);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (query.trim().length < 2) return;
    searchDebounce.current = setTimeout(async () => {
      setLocationSearching(true);
      try {
        const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=5`,
        );
        const json = await res.json();
        setLocationResults(
          (json.features ?? []).map((f: any) => ({
            id: f.id,
            name: f.place_name,
            lat: f.center[1],
            lng: f.center[0],
          })),
        );
      } catch {
        setLocationResults([]);
      } finally {
        setLocationSearching(false);
      }
    }, 300);
  };

  const selectLocation = (item: { name: string; lat: number; lng: number }) => {
    setLocationName(item.name);
    setLocationLat(item.lat);
    setLocationLng(item.lng);
    setLocationEditing(false);
    setLocationQuery('');
    setLocationResults([]);
  };

  const clearLocation = () => {
    setLocationName('');
    setLocationLat(null);
    setLocationLng(null);
    setLocationEditing(false);
    setLocationQuery('');
    setLocationResults([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const syncGeofences = async () => {
    try {
      const { data } = await apiClient.get<Routine[]>('/routines');
      const granted = await LocationService.requestPermissions();
      if (granted && data.length > 0) {
        await LocationService.registerGeofences(
          data.map((r) => ({
            id: r.id,
            latitude: r.latitude,
            longitude: r.longitude,
            radius: r.radiusMeters,
          })),
        );
      }
    } catch {
      // silent
    }
  };

  const handleSubmit = async () => {
    if (!missionName.trim()) return;

    const latitude = locationLat ?? 52.52 + (Math.random() - 0.5) * 0.01;
    const longitude = locationLng ?? 13.405 + (Math.random() - 0.5) * 0.01;

    setLoading(true);
    try {
      await apiClient.post('/routines', {
        missionName: missionName.trim(),
        locationName: locationName.trim() || 'Unknown Location',
        latitude,
        longitude,
        radiusMeters: radius,
        iconType: selectedIcon,
      });

      resetForm();
      onClose();
      await syncGeofences();
      onCreated?.();

      const bg = await Location.getBackgroundPermissionsAsync();
      if (bg.status !== 'granted') {
        const raw = await AsyncStorage.getItem('itera_routine_count');
        const count = (raw ? parseInt(raw, 10) : 0) + 1;
        await AsyncStorage.setItem('itera_routine_count', String(count));
        if (count === 1 || count === 3 || count === 7) setShowBgPrompt(true);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'Failed to create routine.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.overlay} behavior="padding">
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Text style={[Typography.displayMD, { color: Colors.textPrimary }]}>NEW MISSION</Text>
              <Pressable onPress={handleClose} hitSlop={8}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={[Typography.label, { color: Colors.textSecondary, marginTop: Spacing.lg }]}>
              Mission Name
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Deep Work Block"
              placeholderTextColor={Colors.muted}
              value={missionName}
              onChangeText={setMissionName}
            />

            <Text style={[Typography.label, { color: Colors.textSecondary, marginTop: Spacing.md }]}>
              Location
            </Text>

            {locationEditing ? (
              <View style={styles.searchContainer}>
                <View style={styles.searchRow}>
                  <Ionicons name="search-outline" size={16} color={Colors.textSecondary} style={{ marginRight: Spacing.sm }} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search for a place..."
                    placeholderTextColor={Colors.muted}
                    value={locationQuery}
                    onChangeText={handleLocationQueryChange}
                    autoFocus
                  />
                  {locationSearching ? (
                    <ActivityIndicator size="small" color={Colors.accent} />
                  ) : (
                    <Pressable
                      onPress={() => {
                        setLocationEditing(false);
                        setLocationQuery('');
                        setLocationResults([]);
                      }}
                      hitSlop={8}
                    >
                      <Ionicons name="close" size={18} color={Colors.textSecondary} />
                    </Pressable>
                  )}
                </View>
                {locationResults.length > 0 && (
                  <View style={styles.resultsList}>
                    {locationResults.map((item, index) => (
                      <Pressable
                        key={item.id}
                        style={[styles.resultItem, index < locationResults.length - 1 && styles.resultBorder]}
                        onPress={() => selectLocation(item)}
                      >
                        <Ionicons name="location-outline" size={15} color={Colors.accent} style={{ marginRight: Spacing.sm, marginTop: 2 }} />
                        <Text style={[Typography.body, { color: Colors.textPrimary, flex: 1 }]} numberOfLines={2}>
                          {item.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <Pressable style={styles.trigger} onPress={() => setLocationEditing(true)}>
                <Ionicons name="location-outline" size={16} color={locationName ? Colors.accent : Colors.textSecondary} style={{ marginRight: Spacing.sm }} />
                <Text style={[Typography.body, { color: locationName ? Colors.textPrimary : Colors.textSecondary, flex: 1 }]}>
                  {locationName || 'Select a location'}
                </Text>
                {locationName ? (
                  <Pressable onPress={clearLocation} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
                  </Pressable>
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
                )}
              </Pressable>
            )}

            {/* XP Reward preview (hardcoded +100 for now) */}
            <View style={styles.xpCard}>
              <View style={{ flex: 1 }}>
                <Text style={[Typography.label, { color: Colors.textSecondary, marginBottom: 3 }]}>XP Reward</Text>
                <Text style={[Typography.caption, { color: Colors.textSecondary }]}>Complete this mission to earn</Text>
              </View>
              <Text style={[Typography.statXL, { color: Colors.accent }]}>+100</Text>
            </View>

            {/* Routine Icon */}
            <Text style={[Typography.label, { color: Colors.textSecondary, marginTop: Spacing.md }]}>
              Routine Icon
            </Text>
            <View style={styles.iconRow}>
              {ICON_OPTIONS.map((icon) => (
                <Pressable
                  key={icon.key}
                  style={[styles.iconOption, selectedIcon === icon.key && styles.iconSelected]}
                  onPress={() => setSelectedIcon(icon.key)}
                >
                  <Ionicons
                    name={icon.name}
                    size={22}
                    color={selectedIcon === icon.key ? Colors.accent : Colors.textSecondary}
                  />
                </Pressable>
              ))}
            </View>

            {/* Advanced — collapsible */}
            <Pressable style={styles.advancedToggle} onPress={() => setAdvancedOpen((v) => !v)}>
              <Ionicons
                name={advancedOpen ? 'chevron-down' : 'chevron-forward'}
                size={14}
                color={Colors.textSecondary}
              />
              <Text style={[Typography.label, { color: Colors.textSecondary, marginLeft: 6 }]}>
                Advanced
              </Text>
            </Pressable>

            {advancedOpen && (
              <View style={styles.advancedBody}>
                <Text style={[Typography.label, { color: Colors.textSecondary }]}>Geofence Radius</Text>
                <View style={styles.sliderRow}>
                  <Text style={[Typography.caption, { color: Colors.textSecondary }]}>50m</Text>
                  <Slider
                    style={{ flex: 1, height: 40, marginHorizontal: Spacing.sm }}
                    minimumValue={50}
                    maximumValue={500}
                    step={10}
                    value={radius}
                    onValueChange={setRadius}
                    minimumTrackTintColor={Colors.accent}
                    maximumTrackTintColor={Colors.border}
                    thumbTintColor={Colors.accent}
                  />
                  <Text style={[Typography.caption, { color: Colors.textSecondary }]}>500m</Text>
                </View>
                <Text style={[Typography.statSM, { color: Colors.accent, textAlign: 'center' }]}>{radius}m</Text>
              </View>
            )}

            <Pressable
              style={[styles.submitButton, loading && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={Colors.background} />
              ) : (
                <Text style={[Typography.cta, { color: Colors.background }]}>LAUNCH MISSION →</Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <BackgroundLocationPrompt
        visible={showBgPrompt}
        onEnable={() => setShowBgPrompt(false)}
        onSkip={() => setShowBgPrompt(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    borderTopWidth: 1,
    borderColor: Colors.borderBright,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  input: {
    backgroundColor: Colors.surface2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    color: Colors.textPrimary,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs,
    height: 48,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    paddingHorizontal: Spacing.md,
    height: 48,
    marginTop: Spacing.xs,
  },
  searchContainer: {
    backgroundColor: Colors.surface2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.accent,
    marginTop: Spacing.xs,
    overflow: 'hidden',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
  },
  resultsList: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
  },
  resultBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  xpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(11,14,26,0.88)',
    borderWidth: 1,
    borderColor: Colors.borderBright,
    borderRadius: 16,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    marginTop: Spacing.md,
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  iconOption: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  iconSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentDim,
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingVertical: 6,
  },
  advancedBody: {
    marginTop: Spacing.sm,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  submitButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
});
