import type { ImageSourcePropType } from 'react-native';

export type HouseId = 'ZEUS' | 'POSEIDON' | 'ATHENA' | 'APHRODITE';
export type HouseFilter = HouseId | 'ALL';

export type HouseTheme = {
  id: HouseId;
  name: string;
  discipline: string;
  motto: string;
  icon: string;
  accent: string;
  highlight: string;
  deep: string;
  surface: string;
  border: string;
  muted: string;
  image: ImageSourcePropType;
};

export const HOUSE_IDS: HouseId[] = ['ZEUS', 'POSEIDON', 'ATHENA', 'APHRODITE'];

export const HOUSES: Record<HouseId, HouseTheme> = {
  ZEUS: {
    id: 'ZEUS',
    name: 'Zeus',
    discipline: 'Electromagnetism · Physics',
    motto: 'Power in every spark',
    icon: 'flash',
    accent: '#E8C36A',
    highlight: '#FFF0B8',
    deep: '#111015',
    surface: 'rgba(31, 27, 31, 0.88)',
    border: 'rgba(232, 195, 106, 0.35)',
    muted: '#C8B993',
    image: require('../assets/images/zeus.jpg'),
  },
  POSEIDON: {
    id: 'POSEIDON',
    name: 'Poseidon',
    discipline: 'Fluid Mechanics · Marine Science',
    motto: 'Steady as the deep',
    icon: 'water',
    accent: '#5DC6D2',
    highlight: '#C2F4F0',
    deep: '#07141B',
    surface: 'rgba(10, 32, 40, 0.88)',
    border: 'rgba(93, 198, 210, 0.34)',
    muted: '#A8D1D2',
    image: require('../assets/images/poseidon.jpg'),
  },
  ATHENA: {
    id: 'ATHENA',
    name: 'Athena',
    discipline: 'Robotics · AI · Computer Science',
    motto: 'Wisdom in motion',
    icon: 'hardware-chip',
    accent: '#C9AE78',
    highlight: '#F4E3B5',
    deep: '#13120F',
    surface: 'rgba(35, 31, 26, 0.88)',
    border: 'rgba(201, 174, 120, 0.35)',
    muted: '#D0C2A3',
    image: require('../assets/images/athena.jpg'),
  },
  APHRODITE: {
    id: 'APHRODITE',
    name: 'Aphrodite',
    discipline: 'Organic Chemistry · Fibonacci Math',
    motto: 'Beauty in every bond',
    icon: 'flower',
    accent: '#E78C9E',
    highlight: '#FFD1D8',
    deep: '#170D13',
    surface: 'rgba(43, 20, 30, 0.89)',
    border: 'rgba(231, 140, 158, 0.35)',
    muted: '#D9B0B9',
    image: require('../assets/images/aphrodite.jpg'),
  },
};

export const HOUSE_LIST = HOUSE_IDS.map((id) => HOUSES[id]);

export function isHouseId(value: unknown): value is HouseId {
  return typeof value === 'string' && HOUSE_IDS.includes(value as HouseId);
}

export const COLORS = {
  ink: '#09090D',
  panel: 'rgba(17, 17, 22, 0.82)',
  parchment: '#F4EBD7',
  paperMuted: '#C3B9A5',
  gold: '#D8B56A',
  danger: '#EE777A',
  success: '#7DD5AA',
  line: 'rgba(255,255,255,0.12)',
};
