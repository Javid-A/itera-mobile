import { useCallback, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ScreenContainer from '../../components/ScreenContainer';
import BackgroundLocationPrompt from '../../components/BackgroundLocationPrompt';
import { Colors, Spacing, Typography } from '../../constants';
import { addRoutine, loadRoutines, removeRoutine } from '../../src/storage/routines';
import { LocationService } from '../../src/services/LocationService';
import type { Routine } from '../../src/types/Routine';

const PRESET_LOCATIONS = [
  { label: 'Brandenburg Gate', lat: 52.5163, lng: 13.3777 },
  { label: 'Berlin Hbf', lat: 52.525, lng: 13.3694 },
  { label: 'Alexanderplatz', lat: 52.5219, lng: 13.4132 },
  { label: 'Potsdamer Platz', lat: 52.5096, lng: 13.3761 },
  { label: 'East Side Gallery', lat: 52.5052, lng: 13.4396 },
];

const ICON_OPTIONS = [
  { key: 'briefcase', name: 'briefcase-outline' as const },
  { key: 'barbell', name: 'barbell-outline' as const },
  { key: 'cafe', name: 'cafe-outline' as const },
  { key: 'star', name: 'star-outline' as const },
  { key: 'home', name: 'home-outline' as const },
  { key: 'school', name: 'school-outline' as const },
];

export default function RoutinesScreen() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [missionName, setMissionName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [radius, setRadius] = useState(100);
  const [selectedIcon, setSelectedIcon] = useState('briefcase');
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [showBgPrompt, setShowBgPrompt] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadRoutines().then(setRoutines);
    }, [])
  );

  const syncGeofences = useCallback(async (list: Routine[]) => {
    const granted = await LocationService.requestPermissions();
    if (granted && list.length > 0) {
      await LocationService.registerGeofences(
        list.map((r) => ({
          id: r.id,
          latitude: r.latitude,
          longitude: r.longitude,
          radius: r.radius,
        }))
      );
    }
  }, []);

  const resetForm = () => {
    setMissionName('');
    setLocationName('');
    setRadius(100);
    setSelectedIcon('briefcase');
    setSelectedPreset(null);
  };

  const handleSubmit = async () => {
    if (!missionName.trim()) return;

    const preset = selectedPreset !== null ? PRESET_LOCATIONS[selectedPreset] : null;
    const lat = preset?.lat ?? 52.52 + (Math.random() - 0.5) * 0.01;
    const lng = preset?.lng ?? 13.405 + (Math.random() - 0.5) * 0.01;

    const routine: Routine = {
      id: Date.now().toString(),
      missionName: missionName.trim(),
      locationName: preset?.label ?? (locationName.trim() || 'Unknown Location'),
      latitude: lat,
      longitude: lng,
      radius,
      iconType: selectedIcon,
    };

    const updated = await addRoutine(routine);
    setRoutines(updated);
    await syncGeofences(updated);
    resetForm();
    setModalVisible(false);

    // Gentle escalation: show prompt on 1st, 3rd, and 7th routine if bg not granted
    const bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status !== 'granted') {
      const raw = await AsyncStorage.getItem('itera_routine_count');
      const count = (raw ? parseInt(raw, 10) : 0) + 1;
      await AsyncStorage.setItem('itera_routine_count', String(count));
      if (count === 1 || count === 3 || count === 7) {
        setShowBgPrompt(true);
      }
    }
  };

  const handleDelete = async (id: string) => {
    const updated = await removeRoutine(id);
    setRoutines(updated);
    await syncGeofences(updated);
  };

  const getIconName = (key: string) =>
    ICON_OPTIONS.find((i) => i.key === key)?.name ?? 'help-outline';

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={[Typography.h2, { color: Colors.textPrimary }]}>Routines</Text>
        <Pressable style={styles.addButton} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={24} color={Colors.textPrimary} />
        </Pressable>
      </View>

      {routines.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[Typography.body, { color: Colors.textSecondary }]}>
            No routines yet. Tap + to create one.
          </Text>
        </View>
      ) : (
        <FlatList
          data={routines}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: Spacing.lg }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Ionicons
                name={getIconName(item.iconType) as any}
                size={24}
                color={Colors.accent}
                style={{ marginRight: Spacing.md }}
              />
              <View style={{ flex: 1 }}>
                <Text style={[Typography.h3, { color: Colors.textPrimary }]}>
                  {item.missionName}
                </Text>
                <Text style={[Typography.caption, { color: Colors.textSecondary }]}>
                  {item.locationName} · {item.radius}m
                </Text>
              </View>
              <Pressable onPress={() => handleDelete(item.id)}>
                <Ionicons name="trash-outline" size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>
          )}
        />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalHeader}>
              <Text style={[Typography.h2, { color: Colors.textPrimary }]}>
                CREATE NEW ROUTINE
              </Text>
              <Pressable onPress={() => { resetForm(); setModalVisible(false); }}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={[Typography.label, { color: Colors.textSecondary, marginTop: Spacing.lg }]}>
              Mission Name
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Berlin Office"
              placeholderTextColor={Colors.textSecondary}
              value={missionName}
              onChangeText={setMissionName}
            />

            <Text style={[Typography.label, { color: Colors.textSecondary, marginTop: Spacing.md }]}>
              Location
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Unter den Linden 10, Berlin"
              placeholderTextColor={Colors.textSecondary}
              value={locationName}
              onChangeText={setLocationName}
            />

            <View style={styles.presetRow}>
              {PRESET_LOCATIONS.map((loc, i) => (
                <Pressable
                  key={loc.label}
                  style={[styles.presetChip, selectedPreset === i && styles.presetSelected]}
                  onPress={() => {
                    setSelectedPreset(i);
                    setLocationName(loc.label);
                  }}
                >
                  <Text style={[
                    Typography.caption,
                    { color: selectedPreset === i ? Colors.accent : Colors.textSecondary },
                  ]}>
                    {loc.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[Typography.label, { color: Colors.textSecondary, marginTop: Spacing.md }]}>
              Geofence Radius
            </Text>
            <View style={styles.sliderRow}>
              <Text style={[Typography.caption, { color: Colors.textSecondary }]}>50m</Text>
              <Slider
                style={{ flex: 1, marginHorizontal: Spacing.sm }}
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
            <Text style={[Typography.body, { color: Colors.accent, textAlign: 'center' }]}>
              {radius}m
            </Text>

            <Text style={[Typography.label, { color: Colors.textSecondary, marginTop: Spacing.md }]}>
              Routine Icon
            </Text>
            <View style={styles.iconRow}>
              {ICON_OPTIONS.map((icon) => (
                <Pressable
                  key={icon.key}
                  style={[
                    styles.iconOption,
                    selectedIcon === icon.key && styles.iconSelected,
                  ]}
                  onPress={() => setSelectedIcon(icon.key)}
                >
                  <Ionicons
                    name={icon.name}
                    size={28}
                    color={selectedIcon === icon.key ? Colors.accent : Colors.textSecondary}
                  />
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.submitButton} onPress={handleSubmit}>
              <Text style={[Typography.h3, { color: Colors.textPrimary }]}>SET ROUTINE</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <BackgroundLocationPrompt
        visible={showBgPrompt}
        onEnable={() => setShowBgPrompt(false)}
        onSkip={() => setShowBgPrompt(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    fontSize: 16,
    padding: Spacing.md,
    marginTop: Spacing.xs,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  presetChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  presetSelected: {
    borderColor: Colors.accent,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Spacing.sm,
  },
  iconOption: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconSelected: {
    borderColor: Colors.accent,
  },
  submitButton: {
    backgroundColor: Colors.accent,
    borderRadius: 8,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
});
