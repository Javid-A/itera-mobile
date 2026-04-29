import { useCallback, useRef, useState } from "react";

export interface LocationResult {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

// Mapbox geocoding araması — 300ms debounce, query 2+ karakter olmalı.
// Sonuçlar UI tarafında listelenir; component clearResults() çağırarak temizler.
export function useLocationSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onQueryChange = useCallback((next: string) => {
    setQuery(next);
    setResults([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (next.trim().length < 2) return;
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(next)}.json?access_token=${token}&limit=5`,
        );
        const json = await res.json();
        setResults(
          (json.features ?? []).map((f: any) => ({
            id: f.id,
            name: f.place_name,
            lat: f.center[1],
            lng: f.center[0],
          })),
        );
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  const reset = useCallback(() => {
    setQuery("");
    setResults([]);
    setSearching(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  return { query, results, searching, onQueryChange, reset };
}
