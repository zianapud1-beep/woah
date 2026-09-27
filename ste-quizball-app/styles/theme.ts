/**
 * Central design system for the STE Quizball Olympus experience.
 * Classical oil-painting aesthetic: chiaroscuro depths, gold leaf accents,
 * parchment text — blended with subtle STE motifs per house.
 */

export type HouseId = 'zeus' | 'poseidon' | 'athena' | 'aphrodite';

export interface HouseColors {
  primary: string;
  secondary: string;
  accent: string;
  gold: string;
  goldSoft: string;
  deep: string;
  parchment: string;
  ink: string;
  card: string;
}

export interface HouseTheme {
  id: HouseId;
  name: string;
  epithet: string;
  domain: string;
  motto: string;
  /** Ionicons name */
  icon: string;
  colors: HouseColors;
  /** 6-digit hex gradient stops (dark overlay painted over house artwork) */
  gradient: [string, string, string];
}

export const HOUSES: Record<HouseId, HouseTheme> = {
  zeus: {
    id: 'zeus',
    name: 'Zeus',
    epithet: 'House of the Storm',
    domain: 'Electromagnetism • Physics',
    motto: 'Strike First, Strike True',
    icon: 'flash',
    colors: {
      primary: '#232B4D',
      secondary: '#3B4A7A',
      accent: '#F5C542',
      gold: '#D4AF37',
      goldSoft: '#EFD98A',
      deep: '#0B0E1A',
      parchment: '#F5EDD6',
      ink: '#101323',
      card: 'rgba(11, 14, 26, 0.78)',
    },
    gradient: ['#141A33', '#1B2340', '#0B0E1A'],
  },
  poseidon: {
    id: 'poseidon',
    name: 'Poseidon',
    epithet: 'House of the Tide',
    domain: 'Fluid Mechanics • Marine Science',
    motto: 'Depth Holds Dominion',
    icon: 'water',
    colors: {
      primary: '#0A3B52',
      secondary: '#0E5A74',
      accent: '#2EC4B6',
      gold: '#C9A227',
      goldSoft: '#E5D189',
      deep: '#020F18',
      parchment: '#E8F4F1',
      ink: '#06222E',
      card: 'rgba(2, 15, 24, 0.78)',
    },
    gradient: ['#06334A', '#04263B', '#020F18'],
  },
  athena: {
    id: 'athena',
    name: 'Athena',
    epithet: 'House of the Owl',
    domain: 'Robotics • AI • Computing',
    motto: 'Wisdom Builds Worlds',
    icon: 'bulb',
    colors: {
      primary: '#4A3B24',
      secondary: '#7A6742',
      accent: '#C9CCD6',
      gold: '#B08D57',
      goldSoft: '#D9C29A',
      deep: '#14100A',
      parchment: '#F1E8D8',
      ink: '#1D1509',
      card: 'rgba(20, 16, 10, 0.80)',
    },
    gradient: ['#4A3B24', '#3A2E1E', '#14100A'],
  },
  aphrodite: {
    id: 'aphrodite',
    name: 'Aphrodite',
    epithet: 'House of the Bloom',
    domain: 'Organic Chemistry • Mathematics',
    motto: 'Beauty Is Precision',
    icon: 'heart',
    colors: {
      primary: '#5E1428',
      secondary: '#8E2A40',
      accent: '#F4A7C3',
      gold: '#E8B4A0',
      goldSoft: '#F6D3C2',
      deep: '#160409',
      parchment: '#FAEDE6',
      ink: '#22060F',
      card: 'rgba(22, 4, 9, 0.78)',
    },
    gradient: ['#5E1428', '#4A0E1C', '#160409'],
  },
};

export const HOUSE_IDS: HouseId[] = ['zeus', 'poseidon', 'athena', 'aphrodite'];

/** Bulletin filter chip -> house id (null = ALL) */
export function houseIdFromLabel(label: string): HouseId | null {
  const key = label.trim().toLowerCase();
  if (key === 'all') return null;
  return (HOUSE_IDS as string[]).includes(key) ? (key as HouseId) : null;
}

export const Fonts = {
  display: 'Cinzel_700Bold',
  displayBlack: 'Cinzel_900Black',
  body: 'CormorantGaramond_500Medium',
  bodySemi: 'CormorantGaramond_600SemiBold',
  bodyBold: 'CormorantGaramond_700Bold',
} as const;

export const Palette = {
  gold: '#D4AF37',
  goldSoft: '#E8CF7A',
  goldDeep: '#8A6D1F',
  parchment: '#F3EAD3',
  parchmentDim: '#C9BFA6',
  ink: '#14100A',
  abyss: '#07080F',
  card: 'rgba(8, 10, 18, 0.78)',
  cardBorder: 'rgba(212, 175, 55, 0.45)',
  danger: '#E74C3C',
  success: '#2ECC71',
  info: '#5DADE2',
  muted: '#9A917E',
} as const;

export const OFFICER_PIN = 'STE_OFFICER_2026';

/** Shared majestic text shadows (chiaroscuro lift off dark canvas) */
export const TextShadow = {
  goldTitle: {
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  soft: {
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
} as const;
