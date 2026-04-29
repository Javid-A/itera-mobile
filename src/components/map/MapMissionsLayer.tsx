import { useMemo } from "react";
import { Colors } from "../../constants";
import {
  ShapeSource,
  LineLayer,
  FillExtrusionLayer,
  MarkerView,
} from "../../services/mapbox";
import MissionPin from "../MissionPin";
import { buildGeofenceGeoJSON } from "../../utils/geofence";
import type { Mission } from "../../types/Mission";

interface Props {
  missions: Mission[];
  completingMissionId: string | null;
}

// MapView altına yerleşen mission katmanı: turuncu geofence halkası (LineLayer +
// 3 katmanlı FillExtrusion duvarı) ve her mission için ikon pini.
// Tamamlanmış veya o anda animasyonlanan mission ana ShapeSource'tan dışlanır
// (CompletionRingLayer onu ayrıca animasyonla render eder).
export default function MapMissionsLayer({
  missions,
  completingMissionId,
}: Props) {
  const geofenceGeoJSON = useMemo(
    () =>
      buildGeofenceGeoJSON(
        missions.filter(
          (m) => m.id !== completingMissionId && m.status !== "completed",
        ),
      ),
    [missions, completingMissionId],
  );

  return (
    <>
      <ShapeSource id="geofences" shape={geofenceGeoJSON}>
        <LineLayer
          id="geofence-glow"
          style={{
            lineColor: "rgba(249, 115, 22, 0.6)",
            lineWidth: 18,
            lineBlur: 12,
          }}
        />
        <LineLayer
          id="geofence-ring"
          style={{
            lineColor: "rgba(255, 160, 80, 1)",
            lineWidth: 2,
          }}
        />
        <FillExtrusionLayer
          id="geofence-wall-base"
          style={{
            fillExtrusionColor: Colors.orange,
            fillExtrusionHeight: ["min", ["*", ["get", "radius"], 0.05], 6],
            fillExtrusionBase: 0,
            fillExtrusionOpacity: 0.42,
            fillExtrusionVerticalGradient: true,
          }}
        />
        <FillExtrusionLayer
          id="geofence-wall-mid"
          style={{
            fillExtrusionColor: Colors.orange,
            fillExtrusionHeight: ["min", ["*", ["get", "radius"], 0.1], 14],
            fillExtrusionBase: ["min", ["*", ["get", "radius"], 0.05], 6],
            fillExtrusionOpacity: 0.22,
            fillExtrusionVerticalGradient: true,
          }}
        />
        <FillExtrusionLayer
          id="geofence-wall-top"
          style={{
            fillExtrusionColor: Colors.orange,
            fillExtrusionHeight: ["min", ["*", ["get", "radius"], 0.18], 22],
            fillExtrusionBase: ["min", ["*", ["get", "radius"], 0.1], 14],
            fillExtrusionOpacity: 0.08,
            fillExtrusionVerticalGradient: true,
          }}
        />
      </ShapeSource>

      {missions.map((mission) => (
        <MarkerView
          key={mission.id}
          coordinate={[mission.longitude, mission.latitude]}
          anchor={{ x: 0.5, y: 1 }}
        >
          <MissionPin
            iconType={mission.iconType}
            completed={mission.status === "completed"}
            tier={mission.tier}
          />
        </MarkerView>
      ))}
    </>
  );
}
