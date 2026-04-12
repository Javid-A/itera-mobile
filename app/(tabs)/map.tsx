import { StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../../constants';

let MapboxAvailable = false;
let Mapbox: any;
let MapView: any;
let Camera: any;
let FillExtrusionLayer: any;

try {
  const maps = require('@rnmapbox/maps');
  Mapbox = maps.default;
  MapView = maps.MapView;
  Camera = maps.Camera;
  FillExtrusionLayer = maps.FillExtrusionLayer;
  Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');
  MapboxAvailable = true;
} catch {
  MapboxAvailable = false;
}

export default function MapScreen() {
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
