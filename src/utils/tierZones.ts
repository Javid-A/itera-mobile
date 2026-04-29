import { TIER_VISUAL } from "../config/tierConfig";

const RING_STEPS = 64;

function ringCoords(
  lng: number,
  lat: number,
  r: number,
  steps = RING_STEPS,
): [number, number][] {
  const c: [number, number][] = [];
  const k = 111320 * Math.cos((lat * Math.PI) / 180);
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    c.push([lng + (r * Math.cos(a)) / k, lat + (r * Math.sin(a)) / 111320]);
  }
  c.push(c[0]);
  return c;
}

export function createCircleGeoJSON(lng: number, lat: number, r: number) {
  return {
    type: "Feature" as const,
    geometry: {
      type: "Polygon" as const,
      coordinates: [ringCoords(lng, lat, r)],
    },
    properties: {},
  };
}

function createAnnulusGeoJSON(
  lng: number,
  lat: number,
  innerR: number,
  outerR: number,
) {
  return {
    type: "Feature" as const,
    geometry: {
      type: "Polygon" as const,
      coordinates: [
        ringCoords(lng, lat, outerR),
        ringCoords(lng, lat, innerR).slice().reverse(),
      ],
    },
    properties: {},
  };
}

// B sınırından dışa doğru radyal degrade için birden fazla annulus üret.
// Sınıra yakın en parlak, uzaklaştıkça quadratic falloff ile sönüyor.
function createGradientStops(
  lng: number,
  lat: number,
  innerR: number,
  outerR: number,
  peakOpacity: number,
  steps = 14,
) {
  const stops: {
    feature: ReturnType<typeof createAnnulusGeoJSON>;
    opacity: number;
  }[] = [];
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    const easeRadius = (t: number) => Math.pow(t, 1.4);
    const r0 = innerR + (outerR - innerR) * easeRadius(t0);
    const r1 = innerR + (outerR - innerR) * easeRadius(t1);
    const opacity = peakOpacity * Math.pow(1 - t0, 2);
    stops.push({
      feature: createAnnulusGeoJSON(lng, lat, r0, r1),
      opacity,
    });
  }
  return stops;
}

export type TierZones = {
  A: ReturnType<typeof createCircleGeoJSON>;
  B: ReturnType<typeof createCircleGeoJSON>;
  C_gradient: ReturnType<typeof createGradientStops>;
  A_label: [number, number];
  B_label: [number, number];
  C_label: [number, number];
};

// Kullanıcı koordinatından A/B daireleri, C radyal degrade ve etiket koordinatları.
export function buildTierZones(userCoord: [number, number]): TierZones {
  const [lng, lat] = userCoord;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  return {
    A: createCircleGeoJSON(lng, lat, TIER_VISUAL.aRadiusMeters),
    B: createCircleGeoJSON(lng, lat, TIER_VISUAL.bRadiusMeters),
    C_gradient: createGradientStops(
      lng,
      lat,
      TIER_VISUAL.bRadiusMeters,
      TIER_VISUAL.cGradientOuterMeters,
      0.6,
      14,
    ),
    A_label: [lng + TIER_VISUAL.aLabelEastMeters / (111320 * cosLat), lat],
    B_label: [lng + TIER_VISUAL.bLabelEastMeters / (111320 * cosLat), lat],
    C_label: [
      lng + TIER_VISUAL.cLabelEastMeters / (111320 * cosLat),
      lat - TIER_VISUAL.cLabelSouthMeters / 111320,
    ],
  };
}
