import { useMemo } from "react";
import { Colors } from "../../constants";
import {
  ShapeSource,
  LineLayer,
  FillExtrusionLayer,
} from "../../services/mapbox";
import { buildGeofenceGeoJSON } from "../../utils/geofence";
import type { Mission } from "../../types/Mission";

interface Props {
  mission: Mission;
  // 0 → 1 arası: ring çapını animasyonlamak için (parent Animated.Value listener'ı
  // ile sayıya çevirip geçer; her tick'te yeni geoJSON üretir).
  scale: number;
  // Tamamlandığında yeşil, başlangıçta turuncu (kapanan halka).
  isGreen: boolean;
}

export default function CompletionRingLayer({ mission, scale, isGreen }: Props) {
  const geoJSON = useMemo(
    () => buildGeofenceGeoJSON([mission], scale),
    [mission, scale],
  );

  return (
    <ShapeSource id="completion-ring" shape={geoJSON}>
      <LineLayer
        id="completion-ring-glow"
        style={{
          lineColor: isGreen
            ? "rgba(34, 197, 94, 0.6)"
            : "rgba(249, 115, 22, 0.6)",
          lineWidth: 18,
          lineBlur: 12,
        }}
      />
      <LineLayer
        id="completion-ring-line"
        style={{
          lineColor: isGreen ? "rgba(34, 197, 94, 1)" : "rgba(255, 160, 80, 1)",
          lineWidth: 2,
        }}
      />
      <FillExtrusionLayer
        id="completion-wall-base"
        style={{
          fillExtrusionColor: isGreen ? Colors.success : Colors.orange,
          fillExtrusionHeight: ["min", ["*", ["get", "radius"], 0.05], 6],
          fillExtrusionBase: 0,
          fillExtrusionOpacity: isGreen ? 0.55 : 0.42,
          fillExtrusionVerticalGradient: true,
        }}
      />
      <FillExtrusionLayer
        id="completion-wall-mid"
        style={{
          fillExtrusionColor: isGreen ? Colors.success : Colors.orange,
          fillExtrusionHeight: ["min", ["*", ["get", "radius"], 0.1], 14],
          fillExtrusionBase: ["min", ["*", ["get", "radius"], 0.05], 6],
          fillExtrusionOpacity: isGreen ? 0.35 : 0.22,
          fillExtrusionVerticalGradient: true,
        }}
      />
      <FillExtrusionLayer
        id="completion-wall-top"
        style={{
          fillExtrusionColor: isGreen ? Colors.success : Colors.orange,
          fillExtrusionHeight: ["min", ["*", ["get", "radius"], 0.18], 22],
          fillExtrusionBase: ["min", ["*", ["get", "radius"], 0.1], 14],
          fillExtrusionOpacity: isGreen ? 0.18 : 0.08,
          fillExtrusionVerticalGradient: true,
        }}
      />
    </ShapeSource>
  );
}
