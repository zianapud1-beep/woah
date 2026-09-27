import type { HouseId } from '@/services/types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  STE QUIZBALL — "THE GILDED SALON"
 *  A classical oil-painting design system: baroque chiaroscuro, gilding,
 *  parchment and canvas for the four houses of Libertad National High School.
 *
 *  Every visual token lives here so screens stay free of hard-coded colour.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type ImageSourceProp = number;

/* ------------------------------------------------------------------ colour */

export const ink = {
  /** Near-black with a blue undertone, the colour of an unlit canvas. */
  abyss: '#05070F',
  night: '#0B0F1A',
  umber: '#1A140F',
  shadow: '#12100E',
  smoke: '#2A2A33',
  slate: '#4A4F63',
  ash: '#8C8FA3',
  bone: '#D9D2C4',
  parchment: '#EFE3C8',
  vellum: '#F7EFDC',
  gold: '#D4AF37',
  goldBright: '#F3D98B',
  goldDeep: '#8C6A1F',
  oxblood: '#6E1B1B',
  verdigris: '#2E5B57',
} as const;

/** Shared surface treatments (canvas, gesso, gilding). */
export const surface = {
  panel: 'rgba(10, 12, 20, 0.82)',
  panelSolid: '#0D1019',
  panelRaised: 'rgba(24, 26, 38, 0.92)',
  panelSunken: 'rgba(4, 6, 12, 0.72)',
  hairline: 'rgba(212, 175, 55, 0.28)',
  hairlineSoft: 'rgba(212, 175, 55, 0.14)',
  canvas: 'rgba(239, 227, 200, 0.04)',
} as const;

export const typography = {
  /** Engraved roman capitals — used for titles and the house names. */
  display: 'Cinzel_700Bold',
  displayRegular: 'Cinzel_400Regular',
  displayBlack: 'Cinzel_900Black',
  /** Sub-labels, chips, small caps. */
  label: 'Marcellus_400Regular',
  /** Painted italic captions, bulletin body copy. */
  script: 'IMFellEnglish_400Regular_Italic',
  /** Long-form body text, question copy. */
  body: 'EBGaramond_400Regular',
  bodyMedium: 'EBGaramond_500Medium',
  bodySemibold: 'EBGaramond_600SemiBold',
  bodyBold: 'EBGaramond_700Bold',
  /** Numerals on the scoreboard. */
  numeral: 'Cinzel_800ExtraBold',
} as const;

export const radii = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 14,
  xl: 22,
  pill: 999,
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Chiaroscuro shadows — light from the upper left, as in the plates. */
export const shadow = {
  plate: {
    shadowColor: '#000000',
    shadowOpacity: 0.75,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  gilding: {
    shadowColor: ink.gold,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  inset: {
    shadowColor: '#000000',
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
} as const;

/* ------------------------------------------------------------------ houses */

export interface HouseTheme {
  id: HouseId;
  name: string;
  /** Latin epithet engraved beneath the name. */
  epithet: string;
  /** The academic discipline the house represents. */
  stream: string;
  /** Short discipline tag used on chips and cards. */
  short: string;
  /** Painted plate used as the themed background. */
  plate: ImageSourceProp;
  /** Deepest shadow of the plate — used for gradient footers. */
  shade: string;
  /** Mid tone of the plate. */
  mid: string;
  /** House identity colour: gilding, enamel, verdigris… */
  primary: string;
  /** Secondary accent for gradients. */
  secondary: string;
  /** Brightest highlight — glows, counters, icons. */
  accent: string;
  /** Text colour that always reads on this plate. */
  onPrimary: string;
  /** Gradient stops for progress bars, in order. */
  bar: readonly [string, string, string];
  /** Outline colour for themed controls. */
  line: string;
  /** Icon used in compact contexts. */
  icon: string;
  /** Svg path drawn by <HouseSigil/> (24×24 viewBox). */
  sigil: string;
  /** Sigil used at large sizes with a double outline. */
  sigilBold?: string;
}

/**
 * The four Olympiad houses. Each is a full palette: identity colour, accent,
 * bar gradient and the classical plate that backs every screen.
 */
export const HOUSES: Record<HouseId, HouseTheme> = {
  zeus: {
    id: 'zeus',
    name: 'Zeus',
    epithet: 'Rex Tonitruum',
    stream: 'Electromagnetism · Physics',
    short: 'PHYSICS',
    plate: require('../assets/houses/zeus.jpg'),
    shade: '#080C18',
    mid: '#16233C',
    primary: '#F2C14E',
    secondary: '#B8860B',
    accent: '#FFF3C4',
    onPrimary: '#241A05',
    bar: ['#3A2A08', '#B8860B', '#F3D98B'],
    line: 'rgba(242, 193, 78, 0.45)',
    icon: 'flash',
    sigil: 'M13 2 4 14h6l-1 8 9-12h-6l1-8Z',
  },
  poseidon: {
    id: 'poseidon',
    name: 'Poseidon',
    epithet: 'Rerum Oceanus',
    stream: 'Fluid Mechanics · Marine Science',
    short: 'MARINE',
    plate: require('../assets/houses/poseidon.jpg'),
    shade: '#05131A',
    mid: '#0E3540',
    primary: '#4FC3C7',
    secondary: '#1D6F7A',
    accent: '#CFF6F4',
    onPrimary: '#02222A',
    bar: ['#052A33', '#1D6F7A', '#6FE1DC'],
    line: 'rgba(79, 195, 199, 0.45)',
    icon: 'water',
    sigil: 'M2 15c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2M2 20c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2M12 3 6 11h5l-1 6 7-9h-5l1-5Z',
  },
  athena: {
    id: 'athena',
    name: 'Athena',
    epithet: 'Dea Sapientiae',
    stream: 'Robotics · AI · Computer Science',
    short: 'ROBOTICS',
    plate: require('../assets/houses/athena.jpg'),
    shade: '#100D08',
    mid: '#33301F',
    primary: '#C9A227',
    secondary: '#8A8D98',
    accent: '#EFE7D2',
    onPrimary: '#1B1608',
    bar: ['#2A2620', '#8A8D98', '#E7DFC9'],
    line: 'rgba(201, 162, 39, 0.45)',
    icon: 'hardware-chip',
    sigil: 'M12 2 3 6v6c0 5 3.8 8.6 9 10 5.2-1.4 9-5 9-10V6l-9-4Zm0 4.5 5 2.2V12c0 3.4-2.1 6-5 7-2.9-1-5-3.6-5-7V8.7l5-2.2Z',
  },
  aphrodite: {
    id: 'aphrodite',
    name: 'Aphrodite',
    epithet: 'Dea Amoris',
    stream: 'Organic Chemistry · Fibonacci Math',
    short: 'CHEMISTRY',
    plate: require('../assets/houses/aphrodite.jpg'),
    shade: '#1A070C',
    mid: '#4A1420',
    primary: '#E0577F',
    secondary: '#A3243F',
    accent: '#FFD9E3',
    onPrimary: '#2B0714',
    bar: ['#3B0A16', '#A3243F', '#FFB9CB'],
    line: 'rgba(224, 87, 127, 0.45)',
    icon: 'flower',
    sigil:
      'M12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0-2.4a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2Zm0-1.6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  },
};

export const HOUSE_ORDER: readonly HouseId[] = [
  'zeus',
  'poseidon',
  'athena',
  'aphrodite',
];

export function houseTheme(id: HouseId | null | undefined): HouseTheme {
  return HOUSES[id ?? 'zeus'] ?? HOUSES.zeus;
}

/** A neutral palette used by officer/staff surfaces (display + admin). */
export const neutral = {
  plate: require('../assets/houses/athena.jpg'),
  primary: ink.gold,
  secondary: '#8A6D2A',
  accent: ink.goldBright,
  onPrimary: '#1A1204',
  shade: '#08080C',
  mid: '#22222C',
  line: 'rgba(212, 175, 55, 0.35)',
  bar: ['#2A2415', '#8C6A1F', '#E8CF94'] as const,
} as const;

/* -------------------------------------------------------------- gradients */

export const gradients = {
  /** Chiaroscuro scrim: dark at the top, opening in the middle. */
  scrim: (c = '#05070F') =>
    [
      [c, 0.96],
      [c, 0.82],
      [c, 0.55],
      [c, 0.78],
      [c, 0.95],
    ] as const,
  vignette: ['rgba(5,7,15,0.0)', 'rgba(5,7,15,0.35)', 'rgba(5,7,15,0.9)'] as const,
  goldEdge: ['rgba(212,175,55,0.0)', 'rgba(212,175,55,0.45)', 'rgba(212,175,55,0.0)'] as const,
  gilded: [
    ['#8C6A1F', 0],
    ['#F3D98B', 0.5],
    ['#A9801F', 1],
  ] as const,
  wax: ['#7A1414', '#3A0808'] as const,
} as const;

/* ---------------------------------------------------------------- helpers */

/** `elevation`-safe style object for RN shadow props. */
export function plateShadow(level: 1 | 2 | 3 = 1) {
  const presets = {
    1: { opacity: 0.5, radius: 10, offset: 6, elevation: 6 },
    2: { opacity: 0.65, radius: 18, offset: 10, elevation: 12 },
    3: { opacity: 0.8, radius: 28, offset: 16, elevation: 20 },
  } as const;
  const p = presets[level];
  return {
    shadowColor: '#000000',
    shadowOpacity: p.opacity,
    shadowRadius: p.radius,
    shadowOffset: { width: 0, height: p.offset },
    elevation: p.elevation,
  } as const;
}

/** Convert a hex colour with alpha into an rgba() string. */
export function alpha(hex: string, a: number): string {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Pick legible text for a given background colour. */
export function readableOn(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#120E06' : '#F7EFDC';
}
