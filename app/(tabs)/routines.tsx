import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ScreenContainer from '../../components/ScreenContainer';
import BackgroundLocationPrompt from '../../components/BackgroundLocationPrompt';
import { Colors, Spacing, Typography } from '../../constants';
import { LocationService } from '../../src/services/LocationService';
import apiClient from '../../src/services/apiClient';
import type { Routine } from '../../src/types/Routine';


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
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [missionName, setMissionName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [radius, setRadius] = useState(100);
  const [selectedIcon, setSelectedIcon] = useState('briefcase');
  const [showBgPrompt, setShowBgPrompt] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuRoutineId, setMenuRoutineId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ y: 0 });

  const fetchRoutines = useCallback(async () => {
    try {
      const { data } = await apiClient.get<Routine[]>('/routines');
      setRoutines(data);
      await syncGeofences(data);
    } catch {
      // Silently fail — routines will be empty but app stays functional
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchRoutines();
    }, [fetchRoutines])
  );

  const syncGeofences = async (list: Routine[]) => {
    const granted = await LocationService.requestPermissions();
    if (granted && list.length > 0) {
      await LocationService.registerGeofences(
        list.map((r) => ({
          id: r.id,
          latitude: r.latitude,
          longitude: r.longitude,
          radius: r.radiusMeters,
        }))
      );
    }
  };

  const resetForm = () => {
    setMissionName('');
    setLocationName('');
    setRadius(100);
    setSelectedIcon('briefcase');
  };

  const handleSubmit = async () => {
    if (!missionName.trim()) return;

    const latitude = 52.52 + (Math.random() - 0.5) * 0.01;
    const longitude = 13.405 + (Math.random() - 0.5) * 0.01;

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
      setModalVisible(false);
      await fetchRoutines();

      // Gentle escalation: show bg prompt on 1st, 3rd, and 7th routine
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

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/routines/${id}`);
      const updated = routines.filter((r) => r.id !== id);
      setRoutines(updated);
      await syncGeofences(updated);
    } catch {
      Alert.alert('Error', 'Failed to delete routine.');
    }
  };

  const getIconName = (key: string) =>
    ICON_OPTIONS.find((i) => i.key === key)?.name ?? 'help-outline';

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={[Typography.h2, { color: Colors.textPrimary }]}>Routines</Text>
      </View>

      {routines.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="repeat-outline" size={48} color={Colors.border} style={{ marginBottom: Spacing.md }} />
          <Text style={[Typography.body, { color: Colors.textSecondary }]}>
            No routines yet.
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
                  {item.locationName} · {item.radiusMeters}m
                </Text>
              </View>
              <Pressable
                onPress={(e) => {
                  setMenuPosition({ y: e.nativeEvent.pageY });
                  setMenuRoutineId(item.id);
                  setMenuVisible(true);
                }}
                hitSlop={8}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>
          )}
        />
      )}

      <Pressable style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={28} color={Colors.textPrimary} />
      </Pressable>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior="padding"
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
            <Pressable style={styles.locationTrigger} onPress={() => { /* TODO: open Location Picker */ }}>
              <Text style={[Typography.body, { color: locationName ? Colors.textPrimary : Colors.textSecondary, flex: 1 }]}>
                {locationName || 'Select a location'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
            </Pressable>

            <Text style={[Typography.label, { color: Colors.textSecondary, marginTop: Spacing.md }]}>
              Geofence Radius
            </Text>
            <View style={styles.sliderRow}>
              <Text style={[Typography.caption, { color: Colors.textSecondary }]}>50m</Text>
              <Slider
                style={{ flex: 1, height: 44, marginHorizontal: Spacing.sm }}
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
                    color={selectedIcon === icon.key ? Colors.accent : 'rgba(255, 255, 255, 0.45)'}
                  />
                </Pressable>
              ))}
            </View>

            <Pressable style={[styles.submitButton, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
              {loading
                ? <ActivityIndicator color={Colors.textPrimary} />
                : <Text style={[Typography.h3, { color: Colors.textPrimary }]}>SET ROUTINE</Text>
              }
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
          <View style={[styles.menuCard, { top: menuPosition.y + 8 }]}>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                if (menuRoutineId) handleDelete(menuRoutineId);
              }}
            >
              <Ionicons name="trash-outline" size={16} color="#FF4444" />
              <Text style={[Typography.body, { color: '#FF4444', marginLeft: Spacing.sm }]}>
                Delete Routine
              </Text>
            </Pressable>
          </View>
        </Pressable>
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
  fab: {
    position: 'absolute',
    bottom: Spacing.lg,
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
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
    marginBottom: Spacing.md,
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
    borderColor: '#444444',
    color: Colors.textPrimary,
    fontSize: 16,
    padding: Spacing.md,
    marginTop: Spacing.xs,
  },
  locationTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginTop: Spacing.xs,
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
  menuOverlay: {
    flex: 1,
  },
  menuCard: {
    position: 'absolute',
    right: 16,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 4,
    minWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
});
