import { useEffect, useState } from 'react';

// Bir sonraki gece yarısında verilen callback'i çağırır ve yeniden zamanlar.
// Tick state'i yalnızca timer'ı gece yarısı sonrası tekrar kurmak için tutulur;
// caller tick değerini render'da kullanmaya gerek duymaz.
export function useDayTick(onTick: () => void): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 100);
    const msUntilMidnight = nextMidnight.getTime() - now.getTime();
    const timer = setTimeout(() => {
      onTick();
      setTick((v) => v + 1);
    }, msUntilMidnight);
    return () => clearTimeout(timer);
  }, [tick, onTick]);

  return tick;
}
