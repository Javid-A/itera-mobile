import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { Colors, Typography } from '../../constants';
import { loadRoutines } from '../../src/storage/routines';
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
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserCoords([loc.coords.longitude, loc.coords.latitude]);
      }
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRoutines().then(setRoutines);
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
    <MapView
      style={styles.map}
      styleURL="mapbox://styles/mapbox/dark-v11"
      compassEnabled={false}
      logoEnabled={false}
      attributionEnabled={false}
      scaleBarEnabled={false}
    >
      <Camera
        defaultSettings={{
          centerCoordinate: userCoords ?? [13.405, 52.52],
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
});
