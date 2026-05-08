import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import LevelUpModal from '../components/LevelUpModal';

interface LevelUpPayload {
  level: number;
  earnedXP: number;
}

interface LevelUpContextValue {
  triggerLevelUp: (payload: LevelUpPayload) => void;
}

const LevelUpContext = createContext<LevelUpContextValue | null>(null);

export function LevelUpProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<LevelUpPayload | null>(null);

  const triggerLevelUp = useCallback((next: LevelUpPayload) => {
    setPayload(next);
  }, []);

  const handleClose = useCallback(() => setPayload(null), []);

  return (
    <LevelUpContext.Provider value={{ triggerLevelUp }}>
      {children}
      <LevelUpModal
        visible={payload !== null}
        level={payload?.level ?? 1}
        earnedXP={payload?.earnedXP ?? 0}
        onClose={handleClose}
      />
    </LevelUpContext.Provider>
  );
}

export function useLevelUp(): LevelUpContextValue {
  const ctx = useContext(LevelUpContext);
  if (!ctx) throw new Error('useLevelUp must be used within LevelUpProvider');
  return ctx;
}
