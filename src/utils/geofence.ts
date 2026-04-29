import type { Mission } from "../types/Mission";

const CIRCLE_POINTS = 64;

// Mission listesinden mapbox FillExtrusion/Line katmanlarına besleyebileceğimiz
// FeatureCollection üretir. radiusScale, completion animasyonu daralırken/büyürken
// poligonu yeniden çizmek için kullanılır.
export function buildGeofenceGeoJSON(missions: Mission[], radiusScale = 1) {
  const features = missions.map((r) => {
    const scaledRadius = r.radiusMeters * radiusScale;
    const latRad = (r.latitude * Math.PI) / 180;
    const deltaLng = scaledRadius / (111320 * Math.cos(latRad));
    const deltaLat = scaledRadius / 110540;
    const coords: [number, number][] = [];
    for (let i = 0; i <= CIRCLE_POINTS; i++) {
      const angle = (i / CIRCLE_POINTS) * 2 * Math.PI;
      coords.push([
        r.longitude + deltaLng * Math.cos(angle),
        r.latitude + deltaLat * Math.sin(angle),
      ]);
    }
    return {
      type: "Feature" as const,
      properties: { id: r.id, radius: r.radiusMeters },
      geometry: { type: "Polygon" as const, coordinates: [coords] },
    };
  });
  return { type: "FeatureCollection" as const, features };
}
