import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HOUSES } from '../styles/theme';
import type { HouseId, HouseTheme } from '../styles/theme';

const STORAGE_KEY = 'ste_house_theme';

interface ThemeContextValue {
  house: HouseId;
  theme: HouseTheme;
  setHouse: (h: HouseId) => void;
}

const HouseThemeContext = createContext<ThemeContextValue>({
  house: 'zeus',
  theme: HOUSES.zeus,
  setHouse: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [house, setHouseState] = useState<HouseId>('zeus');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v && (HOUSES as Record<string, HouseTheme>)[v]) {
          setHouseState(v as HouseId);
        }
      })
      .catch(() => {});
  }, []);

  const setHouse = useCallback((h: HouseId) => {
    setHouseState(h);
    AsyncStorage.setItem(STORAGE_KEY, h).catch(() => {});
  }, []);

  return (
    <HouseThemeContext.Provider
      value={{ house, theme: HOUSES[house], setHouse }}
    >
      {children}
    </HouseThemeContext.Provider>
  );
}

export function useHouseTheme(): ThemeContextValue {
  return useContext(HouseThemeContext);
}
