import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';

// Background location izni durumunu takip eder; uygulama foreground'a dönerken
// (OS ayarlarından izin değişmiş olabilir) yeniden kontrol eder.
export function useBackgroundPermission() {
  const [granted, setGranted] = useState(false);
  const appState = useRef(AppState.currentState);

  const refresh = useCallback(() => {
    Location.getBackgroundPermissionsAsync().then((bg) => {
      setGranted(bg.status === 'granted');
    });
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        refresh();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [refresh]);

  return { granted, refresh, setGranted };
}
