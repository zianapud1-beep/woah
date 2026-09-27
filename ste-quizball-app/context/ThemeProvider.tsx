import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  clearOfficerSession,
  isOfficerSessionFresh,
  loadOfficerSession,
  loadSelectedHouse,
  saveOfficerSession,
  saveSelectedHouse,
  type OfficerSession,
} from '@/services/preferences';
import type { HouseId } from '@/services/types';
import { HOUSES, type HouseTheme } from '@/styles/theme';

/**
 * Global house selection. The chosen house drives the background plate, the
 * accent gilding and the bulletin filter across every screen, and is
 * remembered on the device.
 */

interface ThemeContextValue {
  house: HouseId;
  theme: HouseTheme;
  ready: boolean;
  selectHouse: (next: HouseId) => void;
  officerSession: OfficerSession | null;
  unlockOfficer: () => void;
  lockOfficer: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [house, setHouse] = useState<HouseId>('zeus');
  const [ready, setReady] = useState(false);
  const [officerSession, setOfficerSession] = useState<OfficerSession | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [storedHouse, officer] = await Promise.all([
        loadSelectedHouse(),
        loadOfficerSession(),
      ]);
      if (cancelled) return;
      setHouse(storedHouse);
      setOfficerSession(isOfficerSessionFresh(officer) ? officer : null);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectHouse = useCallback((next: HouseId) => {
    setHouse(next);
    void saveSelectedHouse(next);
  }, []);

  const unlockOfficer = useCallback(() => {
    const session: OfficerSession = { unlockedAt: Date.now(), device: 'officer' };
    setOfficerSession(session);
    void saveOfficerSession(session);
  }, []);

  const lockOfficer = useCallback(() => {
    setOfficerSession(null);
    void clearOfficerSession();
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      house,
      theme: HOUSES[house],
      ready,
      selectHouse,
      officerSession,
      unlockOfficer,
      lockOfficer,
    }),
    [house, ready, selectHouse, officerSession, unlockOfficer, lockOfficer],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useAppTheme must be used inside <ThemeProvider>');
  return ctx;
}

export default ThemeContext;
