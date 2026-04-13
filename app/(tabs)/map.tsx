import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Colors, Spacing, Typography } from '../../constants';
import apiClient from '../../src/services/apiClient';
import MissionPin from '../../components/MissionPin';
import type { Routine } from '../../src/types/Routine';

let MapboxAvailable = false;
let Mapbox: any;
let MapView: any;
let Camera: any;
let MarkerView: any;
let FillExtrusionLayer: any;

try {
  const maps = require('@rnmapbox/maps');
  Mapbox = maps.default;
  MapView = maps.MapView;
  Camera = maps.Camera;
  MarkerView = maps.MarkerView;
  FillExtrusionLayer = maps.FillExtrusionLayer;
  Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');
  MapboxAvailable = true;
} catch {
  MapboxAvailable = false;
}

export default function MapScreen() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [bgDenied, setBgDenied] = useState(false);
  const cameraRef = useRef<any>(null);

  const recenter = useCallback(async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      const req = await Location.requestForegroundPermissionsAsync();
      if (req.status !== 'granted') return;
    }
    const last = await Location.getLastKnownPositionAsync();
    const coords = last?.coords ?? (await Location.getCurrentPositionAsync({})).coords;
    cameraRef.current?.setCamera({
      centerCoordinate: [coords.longitude, coords.latitude],
      zoomLevel: 15.5,
      pitch: 65,
      animationDuration: 500,
    });
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;

      // Instant: use cached location
      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        cameraRef.current?.setCamera({
          centerCoordinate: [last.coords.longitude, last.coords.latitude],
          zoomLevel: 15.5,
          pitch: 65,
          animationDuration: 500,
        });
      }
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      apiClient.get('/routines').then(({ data }) => setRoutines(data)).catch(() => {});
      Location.getBackgroundPermissionsAsync().then((bg) => {
        setBgDenied(bg.status !== 'granted');
      });
    }, [])
  );

  if (!MapboxAvailable) {
    return (
      <View style={styles.fallback}>
        <Text style={[Typography.h3, { color: Colors.textPrimary }]}>Map</Text>
        <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: 8 }]}>
          Mapbox requires a development build.
        </Text>
        <Text style={[Typography.caption, { color: Colors.textSecondary }]}>
          Run: npx expo run:ios or npx expo run:android
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.map}>
      {bgDenied && (
        <Pressable style={styles.banner} onPress={async () => {
          await Location.requestBackgroundPermissionsAsync();
          const bg = await Location.getBackgroundPermissionsAsync();
          setBgDenied(bg.status !== 'granted');
        }}>
          <Ionicons name="warning-outline" size={16} color={Colors.accent} />
          <Text style={[Typography.caption, { color: Colors.textSecondary, marginLeft: Spacing.xs, flex: 1 }]}>
            Auto-tracking is off
          </Text>
          <Text style={[Typography.caption, { color: Colors.accent }]}>Enable</Text>
        </Pressable>
      )}
      <MapView
        style={styles.map}
      styleURL="mapbox://styles/mapbox/dark-v11"
      compassEnabled={false}
      logoEnabled={false}
      attributionEnabled={false}
      scaleBarEnabled={false}
    >
      <Camera
        ref={cameraRef}
        defaultSettings={{
          centerCoordinate: [13.405, 52.52],
          zoomLevel: 15.5,
          pitch: 65,
          heading: 0,
        }}
      />
      <FillExtrusionLayer
        id="building-extrusions-3d"
        sourceID="composite"
        sourceLayerID="building"
        minZoomLevel={14}
        maxZoomLevel={24}
        filter={['==', ['get', 'extrude'], 'true']}
        style={{
          fillExtrusionColor: '#1E2128',
          fillExtrusionHeight: ['get', 'height'],
          fillExtrusionBase: ['get', 'min_height'],
          fillExtrusionOpacity: 0.85,
        }}
      />
      {routines.map((routine) => (
        <MarkerView
          key={routine.id}
          coordinate={[routine.longitude, routine.latitude]}
          anchor={{ x: 0.5, y: 1 }}
        >
          <MissionPin iconType={routine.iconType} />
        </MarkerView>
      ))}
    </MapView>
      <Pressable style={styles.recenterButton} onPress={recenter} hitSlop={8}>
        <Ionicons name="locate" size={22} color={Colors.textPrimary} />
      </Pressable>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  recenterButton: {
    position: 'absolute',
    right: Spacing.md,
    bottom: Spacing.xl,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  banner: {
    position: 'absolute',
    top: 50,
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
