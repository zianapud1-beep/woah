import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { HouseId, HOUSES, isHouseId } from '../styles/theme';

const STORAGE_KEY = '@libertad-ste/selected-house';

type HouseThemeContextValue = {
  selectedHouse: HouseId;
  selectedTheme: (typeof HOUSES)[HouseId];
  isThemeReady: boolean;
  setSelectedHouse: (house: HouseId) => Promise<void>;
};

const HouseThemeContext = createContext<HouseThemeContextValue | null>(null);

export function HouseThemeProvider({ children }: React.PropsWithChildren) {
  const [selectedHouse, setSelectedHouseState] = useState<HouseId>('ATHENA');
  const [isThemeReady, setIsThemeReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((storedHouse) => {
        if (mounted && isHouseId(storedHouse)) setSelectedHouseState(storedHouse);
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setIsThemeReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const setSelectedHouse = useCallback(async (house: HouseId) => {
    setSelectedHouseState(house);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, house);
    } catch {
      // The in-memory theme still updates if local storage is unavailable.
    }
  }, []);

  const value = useMemo(
    () => ({ selectedHouse, selectedTheme: HOUSES[selectedHouse], isThemeReady, setSelectedHouse }),
    [selectedHouse, isThemeReady, setSelectedHouse],
  );

  return <HouseThemeContext.Provider value={value}>{children}</HouseThemeContext.Provider>;
}

export function useHouseTheme() {
  const context = useContext(HouseThemeContext);
  if (!context) throw new Error('useHouseTheme must be used within HouseThemeProvider');
  return context;
}
