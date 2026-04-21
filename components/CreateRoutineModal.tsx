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
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Typography } from '../constants';
import apiClient from '../src/services/apiClient';
import { LocationService } from '../src/services/LocationService';
import type { Routine } from '../src/types/Routine';
import BackgroundLocationPrompt from './BackgroundLocationPrompt';
import ChooseOnMapModal from './ChooseOnMapModal';
import XPCountUp from './XPCountUp';

type LocType = {
  key: string;
  label: string;
  iconType: string;
  icon: keyof typeof Ionicons.glyphMap;
  baseXP: number;
};

const LOC_TYPES: LocType[] = [
  { key: 'gym', label: 'Gym', iconType: 'barbell', icon: 'barbell', baseXP: 80 },
  { key: 'cafe', label: 'Café', iconType: 'cafe', icon: 'cafe', baseXP: 60 },
  { key: 'office', label: 'Office', iconType: 'briefcase', icon: 'briefcase', baseXP: 100 },
  { key: 'park', label: 'Park', iconType: 'leaf', icon: 'leaf', baseXP: 70 },
  { key: 'custom', label: 'Custom', iconType: 'star', icon: 'location', baseXP: 50 },
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
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState<{ id: string; name: string; lat: number; lng: number }[]>([]);
  const [locationSearching, setLocationSearching] = useState(false);
  const [selectedType, setSelectedType] = useState<LocType>(LOC_TYPES[2]);
  const [timeWindow, setTimeWindow] = useState(false);
  const [fromHour, setFromHour] = useState(8);
  const [fromMinute, setFromMinute] = useState(0);
  const [fromAmPm, setFromAmPm] = useState<'AM' | 'PM'>('AM');
  const [toHour, setToHour] = useState(12);
  const [toMinute, setToMinute] = useState(0);
  const [toAmPm, setToAmPm] = useState<'AM' | 'PM'>('PM');
  const [activeTimePicker, setActiveTimePicker] = useState<'from' | 'to' | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [radiusMeters, setRadiusMeters] = useState(100);
  const [showBgPrompt, setShowBgPrompt] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetForm = useCallback(() => {
    setMissionName('');
    setLocationName('');
    setLocationLat(null);
    setLocationLng(null);
    setLocationQuery('');
    setLocationResults([]);
    setSelectedType(LOC_TYPES[2]);
    setTimeWindow(false);
    setShowAdvanced(false);
    setRadiusMeters(100);
    setFromHour(8);
    setFromMinute(0);
    setFromAmPm('AM');
    setToHour(12);
    setToMinute(0);
    setToAmPm('PM');
    setActiveTimePicker(null);
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
    setLocationQuery('');
    setLocationResults([]);
  };

  const clearLocation = () => {
    setLocationName('');
    setLocationLat(null);
    setLocationLng(null);
    setLocationQuery('');
    setLocationResults([]);
  };

  const formatTime = (h: number, m: number, ap: 'AM' | 'PM') =>
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ap}`;

  const adjustHour = (which: 'from' | 'to', delta: number) => {
    const set = which === 'from' ? setFromHour : setToHour;
    const cur = which === 'from' ? fromHour : toHour;
    set(((cur - 1 + delta + 12) % 12) + 1);
  };

  const adjustMinute = (which: 'from' | 'to', delta: number) => {
    const set = which === 'from' ? setFromMinute : setToMinute;
    const cur = which === 'from' ? fromMinute : toMinute;
    set((cur + delta * 5 + 60) % 60);
  };

  const toggleAmPm = (which: 'from' | 'to') => {
    if (which === 'from') setFromAmPm((v) => (v === 'AM' ? 'PM' : 'AM'));
    else setToAmPm((v) => (v === 'AM' ? 'PM' : 'AM'));
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
    } catch {}
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
        radiusMeters,
        iconType: selectedType.iconType,
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
          <View style={styles.sheet}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: Spacing.lg, paddingBottom: Spacing.xxl }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.header}>
                <Pressable style={styles.backButton} onPress={handleClose} hitSlop={8}>
                  <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
                </Pressable>
                <View style={{ flex: 1, marginLeft: Spacing.md }}>
                  <Text style={[Typography.displayLG, { color: Colors.textPrimary }]}>New Mission</Text>
                  <Text style={[Typography.body, { color: Colors.textSecondary, marginTop: 2 }]}>
                    Set a routine at a real-world location
                  </Text>
                </View>
              </View>

              {/* Mission Name */}
              <Text style={styles.fieldLabel}>MISSION NAME</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="create-outline" size={16} color={Colors.accent} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Deep Work Block"
                  placeholderTextColor={Colors.textSecondary}
                  value={missionName}
                  onChangeText={setMissionName}
                />
              </View>

              {/* Location Type grid */}
              <Text style={styles.fieldLabel}>LOCATION TYPE</Text>
              <View style={styles.typeGrid}>
                {LOC_TYPES.map((t) => {
                  const selected = selectedType.key === t.key;
                  return (
                    <Pressable
                      key={t.key}
                      style={[styles.typeTile, selected && styles.typeTileSelected]}
                      onPress={() => setSelectedType(t)}
                    >
                      <Ionicons
                        name={t.icon}
                        size={22}
                        color={selected ? Colors.accent : Colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.typeTileLabel,
                          { color: selected ? Colors.accent : Colors.textSecondary },
                        ]}
                      >
                        {t.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Location */}
              <Text style={styles.fieldLabel}>LOCATION</Text>
              <View style={styles.locationField}>
                <Ionicons name="search" size={16} color={Colors.textSecondary} />
                <TextInput
                  style={styles.locationInput}
                  placeholder="Search a place..."
                  placeholderTextColor={Colors.textSecondary}
                  value={locationName || locationQuery}
                  onChangeText={(t) => {
                    if (locationName) clearLocation();
                    handleLocationQueryChange(t);
                  }}
                />
                {locationName ? (
                  <Pressable style={styles.changePill} onPress={clearLocation} hitSlop={6}>
                    <Text style={styles.changePillText}>CHANGE</Text>
                  </Pressable>
                ) : locationSearching ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : null}
              </View>

              {locationResults.length > 0 && (
                <View style={styles.resultsList}>
                  {locationResults.map((item, i) => (
                    <Pressable
                      key={item.id}
                      style={[styles.resultItem, i < locationResults.length - 1 && styles.resultBorder]}
                      onPress={() => selectLocation(item)}
                    >
                      <Ionicons name="location-outline" size={15} color={Colors.accent} />
                      <Text style={[Typography.body, { color: Colors.textPrimary, flex: 1, marginLeft: 8 }]} numberOfLines={2}>
                        {item.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <Pressable style={styles.mapPreview} onPress={() => setShowMapModal(true)}>
                <View style={styles.mapPreviewBg}>
                  {Array.from({ length: 7 }).map((_, i) => (
                    <View key={`h${i}`} style={[styles.mapGridLineH, { top: `${(i + 1) * 12.5}%` }]} />
                  ))}
                  {Array.from({ length: 8 }).map((_, i) => (
                    <View key={`v${i}`} style={[styles.mapGridLineV, { left: `${(i + 1) * 11}%` }]} />
                  ))}
                  <View style={styles.mapGlow} />
                </View>
                {locationName ? (
                  <View style={styles.mapSelectedWrap}>
                    <View style={styles.mapSelectedPin}>
                      <Ionicons name="location" size={18} color={Colors.background} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.mapSelectedName} numberOfLines={1}>
                        {locationName.split(',')[0]}
                      </Text>
                      <Text style={styles.mapSelectedSub} numberOfLines={1}>
                        {locationName.split(',').slice(1, 3).join(',').trim() || 'Tap to change'}
                      </Text>
                    </View>
                    <View style={styles.mapChangePill}>
                      <Text style={styles.mapChangePillText}>CHANGE</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.mapCta}>
                    <View style={styles.mapCtaIcon}>
                      <Ionicons name="location" size={22} color={Colors.accent} />
                    </View>
                    <Text style={styles.mapCtaTitle}>TAP TO CHOOSE ON MAP</Text>
                    <Text style={styles.mapCtaSub}>Pin your mission location</Text>
                  </View>
                )}
              </Pressable>

              {/* Time Window */}
              <Text style={styles.fieldLabel}>TIME WINDOW</Text>
              <Pressable
                style={[styles.timeWindowRow, timeWindow && styles.timeWindowRowActive]}
                onPress={() => {
                  setTimeWindow((v) => !v);
                  setActiveTimePicker(null);
                }}
              >
                <View style={[styles.checkbox, timeWindow && styles.checkboxChecked]}>
                  {timeWindow && <Ionicons name="checkmark" size={14} color={Colors.background} />}
                </View>
                <Text style={[Typography.body, { color: timeWindow ? Colors.textPrimary : Colors.textSecondary, flex: 1, marginLeft: Spacing.sm }]}>
                  Set a time window
                </Text>
                {timeWindow && (
                  <Text style={styles.xpBonusText}>+25 XP bonus</Text>
                )}
                <Ionicons name="time-outline" size={18} color={timeWindow ? Colors.accent : Colors.textSecondary} />
              </Pressable>

              {timeWindow && (
                <View style={styles.timePickerCard}>
                  <View style={styles.timePickerRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.timePickerLabel}>FROM</Text>
                      <Pressable
                        style={[styles.timeButton, activeTimePicker === 'from' && styles.timeButtonActive]}
                        onPress={() => setActiveTimePicker(activeTimePicker === 'from' ? null : 'from')}
                      >
                        <Text style={styles.timeButtonText}>{formatTime(fromHour, fromMinute, fromAmPm)}</Text>
                        <Ionicons name="time-outline" size={16} color={activeTimePicker === 'from' ? Colors.accent : Colors.textSecondary} />
                      </Pressable>
                    </View>
                    <View style={styles.timeArrow}>
                      <Ionicons name="arrow-forward" size={16} color={Colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.timePickerLabel}>TO</Text>
                      <Pressable
                        style={[styles.timeButton, activeTimePicker === 'to' && styles.timeButtonActive]}
                        onPress={() => setActiveTimePicker(activeTimePicker === 'to' ? null : 'to')}
                      >
                        <Text style={styles.timeButtonText}>{formatTime(toHour, toMinute, toAmPm)}</Text>
                        <Ionicons name="time-outline" size={16} color={activeTimePicker === 'to' ? Colors.accent : Colors.textSecondary} />
                      </Pressable>
                    </View>
                  </View>

                  {activeTimePicker && (
                    <View style={styles.timeAdjuster}>
                      <View style={styles.timeAdjusterCol}>
                        <Pressable hitSlop={8} onPress={() => adjustHour(activeTimePicker, 1)}>
                          <Ionicons name="chevron-up" size={18} color={Colors.accent} />
                        </Pressable>
                        <Text style={styles.timeAdjusterValue}>
                          {String(activeTimePicker === 'from' ? fromHour : toHour).padStart(2, '0')}
                        </Text>
                        <Pressable hitSlop={8} onPress={() => adjustHour(activeTimePicker, -1)}>
                          <Ionicons name="chevron-down" size={18} color={Colors.accent} />
                        </Pressable>
                      </View>
                      <Text style={styles.timeAdjusterColon}>:</Text>
                      <View style={styles.timeAdjusterCol}>
                        <Pressable hitSlop={8} onPress={() => adjustMinute(activeTimePicker, 1)}>
                          <Ionicons name="chevron-up" size={18} color={Colors.accent} />
                        </Pressable>
                        <Text style={styles.timeAdjusterValue}>
                          {String(activeTimePicker === 'from' ? fromMinute : toMinute).padStart(2, '0')}
                        </Text>
                        <Pressable hitSlop={8} onPress={() => adjustMinute(activeTimePicker, -1)}>
                          <Ionicons name="chevron-down" size={18} color={Colors.accent} />
                        </Pressable>
                      </View>
                      <Pressable style={styles.amPmButton} onPress={() => toggleAmPm(activeTimePicker)}>
                        <Text style={styles.amPmText}>
                          {activeTimePicker === 'from' ? fromAmPm : toAmPm}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              )}

              {/* XP Reward */}
              <View style={styles.xpCard}>
                <View style={{ flex: 1 }}>
                  <Text style={[Typography.label, { color: Colors.textSecondary }]}>XP REWARD</Text>
                  <View style={styles.xpRow}>
                    <Text style={[Typography.body, { color: Colors.textPrimary }]}>{selectedType.label} base</Text>
                  </View>
                  <View style={styles.baseChip}>
                    <Text style={styles.baseChipText}>{selectedType.baseXP} base</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <XPCountUp
                    key={selectedType.key}
                    target={selectedType.baseXP}
                    prefix="+"
                    duration={800}
                    style={[Typography.statXL, { color: Colors.accent }]}
                  />
                  <Text style={[Typography.label, { color: Colors.textSecondary, marginTop: -4 }]}>XP</Text>
                </View>
              </View>

              {/* Advanced */}
              <Pressable style={styles.advancedToggle} onPress={() => setShowAdvanced(v => !v)}>
                <Ionicons
                  name={showAdvanced ? 'chevron-down' : 'chevron-forward'}
                  size={14}
                  color={Colors.textSecondary}
                />
                <Text style={styles.advancedToggleText}>ADVANCED</Text>
                {!showAdvanced && (
                  <Text style={styles.advancedSummary}>{radiusMeters}m radius</Text>
                )}
              </Pressable>

              {showAdvanced && (
                <View style={styles.advancedCard}>
                  <Text style={styles.fieldLabel}>GEOFENCE RADIUS</Text>
                  <View style={styles.radiusRow}>
                    <Pressable
                      style={styles.radiusBtn}
                      onPress={() => setRadiusMeters(v => Math.max(50, v - 50))}
                      hitSlop={8}
                    >
                      <Ionicons name="remove" size={18} color={Colors.textPrimary} />
                    </Pressable>
                    <View style={styles.radiusValueWrap}>
                      <Text style={styles.radiusValue}>{radiusMeters}</Text>
                      <Text style={styles.radiusUnit}>m</Text>
                    </View>
                    <Pressable
                      style={styles.radiusBtn}
                      onPress={() => setRadiusMeters(v => Math.min(500, v + 50))}
                      hitSlop={8}
                    >
                      <Ionicons name="add" size={18} color={Colors.textPrimary} />
                    </Pressable>
                  </View>
                  <View style={styles.radiusPresets}>
                    {[50, 100, 150, 200, 300, 500].map(r => (
                      <Pressable
                        key={r}
                        style={[styles.radiusPreset, radiusMeters === r && styles.radiusPresetActive]}
                        onPress={() => setRadiusMeters(r)}
                      >
                        <Text style={[styles.radiusPresetText, radiusMeters === r && { color: Colors.accent }]}>
                          {r}m
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.radiusHint}>
                    Mission triggers when you enter this radius around the pin.
                  </Text>
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
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ChooseOnMapModal
        visible={showMapModal}
        onClose={() => setShowMapModal(false)}
        onConfirm={(loc) => selectLocation({ id: `map_${Date.now()}`, ...loc })}
        recentResults={locationResults}
      />

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
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 11,
    letterSpacing: 1.4,
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
  },
  typeGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  typeTile: {
    flex: 1,
    aspectRatio: 0.85,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.borderBright,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  typeTileSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  typeTileLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  locationField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    paddingHorizontal: Spacing.md,
    height: 50,
    gap: 10,
  },
  locationInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
  },
  changePill: {
    backgroundColor: Colors.accentSoft,
    borderWidth: 1,
    borderColor: Colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  changePillText: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    color: Colors.accent,
  },
  resultsList: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    marginTop: Spacing.sm,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
  },
  resultBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  mapPreview: {
    height: 110,
    borderRadius: 16,
    backgroundColor: '#060e1f',
    borderWidth: 1,
    borderColor: Colors.borderBright,
    marginTop: Spacing.sm,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  mapPreviewBg: {
    ...StyleSheet.absoluteFillObject,
  },
  mapGridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(166, 230, 53, 0.05)',
  },
  mapGridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(166, 230, 53, 0.05)',
  },
  mapGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(166, 230, 53, 0.06)',
    alignSelf: 'center',
    top: -20,
  },
  mapCta: {
    alignItems: 'center',
    gap: 4,
  },
  mapCtaIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(166, 230, 53, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  mapCtaTitle: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 12,
    letterSpacing: 1.4,
    color: Colors.accent,
  },
  mapCtaSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.textSecondary,
  },
  mapSelectedWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  mapSelectedPin: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapSelectedName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.textPrimary,
  },
  mapSelectedSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  mapChangePill: {
    backgroundColor: Colors.accentSoft,
    borderWidth: 1,
    borderColor: Colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  mapChangePillText: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 10,
    letterSpacing: 1.2,
    color: Colors.accent,
  },
  timeWindowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    paddingHorizontal: Spacing.md,
    height: 50,
  },
  timeWindowRowActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  xpBonusText: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 12,
    letterSpacing: 0.5,
    color: Colors.accent,
    marginRight: Spacing.sm,
  },
  timePickerCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  timePickerLabel: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 11,
    letterSpacing: 1.4,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  timeButtonActive: {
    borderColor: Colors.accent,
  },
  timeButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colors.textPrimary,
  },
  timeArrow: {
    paddingBottom: 12,
    paddingHorizontal: 4,
  },
  timeAdjuster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    gap: 8,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  timeAdjusterCol: {
    alignItems: 'center',
    gap: 6,
  },
  timeAdjusterValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 28,
    color: Colors.textPrimary,
    minWidth: 44,
    textAlign: 'center',
  },
  timeAdjusterColon: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 24,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  amPmButton: {
    backgroundColor: Colors.accentSoft,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginLeft: 8,
  },
  amPmText: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 15,
    letterSpacing: 1,
    color: Colors.accent,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.borderBright,
    backgroundColor: Colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  xpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    borderRadius: 16,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  xpRow: {
    marginTop: 4,
  },
  baseChip: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(166, 230, 53, 0.55)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  baseChipText: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 10,
    letterSpacing: 1,
    color: Colors.accent,
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.md,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  advancedToggleText: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 11,
    letterSpacing: 1.4,
    color: Colors.textSecondary,
  },
  advancedSummary: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.textSecondary,
    marginLeft: 2,
  },
  advancedCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    padding: Spacing.md,
    marginTop: 6,
  },
  radiusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  radiusBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surface2,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radiusValueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  radiusValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 32,
    color: Colors.textPrimary,
  },
  radiusUnit: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 16,
    color: Colors.textSecondary,
  },
  radiusPresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  radiusPreset: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.surface2,
    borderWidth: 1,
    borderColor: Colors.borderBright,
  },
  radiusPresetActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  radiusPresetText: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 12,
    letterSpacing: 0.5,
    color: Colors.textSecondary,
  },
  radiusHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  submitButton: {
    height: 56,
    borderRadius: 18,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
});
