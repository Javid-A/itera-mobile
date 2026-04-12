import { StyleSheet } from 'react-native';
import Mapbox, { Camera, FillExtrusionLayer, MapView } from '@rnmapbox/maps';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');

export default function MapScreen() {
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
        filter={['==', ['get', 'extrude'], 'true'] as const}
        style={{
          fillExtrusionColor: '#1E2128',
          fillExtrusionHeight: ['get', 'height'] as unknown as number,
          fillExtrusionBase: ['get', 'min_height'] as unknown as number,
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
});
