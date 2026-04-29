import { useEffect, useState } from "react";
import * as Location from "expo-location";

interface State {
  anchorCoords: { lat: number; lng: number } | null;
  anchorError: string | null;
}

// Modal açılırken kullanıcının konumunu bir kere yakalar. Bu anchor mission
// yaratım anında XP tier'ını dondurur (sonradan kullanıcı hareket etse bile
// orijinal mesafe korunur). Modal kapatılınca state sıfırlanır.
export function useMissionAnchor(visible: boolean): State & {
  reset: () => void;
} {
  const [anchorCoords, setAnchorCoords] = useState<
    { lat: number; lng: number } | null
  >(null);
  const [anchorError, setAnchorError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      setAnchorError(null);
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") {
          const req = await Location.requestForegroundPermissionsAsync();
          if (req.status !== "granted") {
            if (!cancelled)
              setAnchorError(
                "Location permission required to classify mission tier.",
              );
            return;
          }
        }
        const last = await Location.getLastKnownPositionAsync();
        const coords =
          last?.coords ??
          (
            await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            })
          ).coords;
        if (!cancelled) {
          setAnchorCoords({ lat: coords.latitude, lng: coords.longitude });
        }
      } catch {
        if (!cancelled) setAnchorError("Could not determine your location.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const reset = () => {
    setAnchorCoords(null);
    setAnchorError(null);
  };

  return { anchorCoords, anchorError, reset };
}
