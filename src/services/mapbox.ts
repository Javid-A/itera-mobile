// Tek noktadan @rnmapbox/maps yüklemesi.
// require try/catch ile sarılı: Expo Go'da modül yoksa MapboxAvailable=false
// kalır ve ekranlar fallback UI gösterir. Token sadece burada set edilir.

let MapboxAvailable = false;
let Mapbox: any;
let MapView: any;
let Camera: any;
let MarkerView: any;
let FillLayer: any;
let FillExtrusionLayer: any;
let ShapeSource: any;
let LineLayer: any;

try {
  const maps = require("@rnmapbox/maps");
  Mapbox = maps.default;
  MapView = maps.MapView;
  Camera = maps.Camera;
  MarkerView = maps.MarkerView;
  FillLayer = maps.FillLayer;
  FillExtrusionLayer = maps.FillExtrusionLayer;
  ShapeSource = maps.ShapeSource;
  LineLayer = maps.LineLayer;
  Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "");
  MapboxAvailable = true;
} catch {
  MapboxAvailable = false;
}

export {
  MapboxAvailable,
  Mapbox,
  MapView,
  Camera,
  MarkerView,
  FillLayer,
  FillExtrusionLayer,
  ShapeSource,
  LineLayer,
};
