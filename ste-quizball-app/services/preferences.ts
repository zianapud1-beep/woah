import AsyncStorage from '@react-native-async-storage/async-storage';

import { localBackend } from './localBackend';
import type { HouseId } from './types';

/**
 * Device-local preferences and the student identity card.
 * Everything here is deliberately *local*: a student's name and house never
 * travel to Firebase until they submit an answer.
 */

const KEYS = {
  house: 'ste_quizball:house',
  student: 'ste_quizball:student',
  officer: 'ste_quizball:officer',
  onboarded: 'ste_quizball:onboarded',
} as const;

export interface StudentProfile {
  id: string;
  name: string;
  house: HouseId;
  createdAt: number;
}

export interface OfficerSession {
  unlockedAt: number;
  device: string;
}

const isHouse = (value: unknown): value is HouseId =>
  value === 'zeus' || value === 'poseidon' || value === 'athena' || value === 'aphrodite';

/** Stable, non-guessable id for this install (used for duplicate detection). */
export async function ensureDeviceId(): Promise<string> {
  const key = 'ste_quizball:deviceId';
  try {
    const existing = await AsyncStorage.getItem(key);
    if (existing) return existing;
    const generated = `stu_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    await AsyncStorage.setItem(key, generated);
    return generated;
  } catch {
    return `stu_${Math.random().toString(36).slice(2, 12)}`;
  }
}

export async function loadSelectedHouse(): Promise<HouseId> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.house);
    if (isHouse(raw)) return raw;
  } catch {
    /* fall through to the default */
  }
  return 'zeus';
}

export async function saveSelectedHouse(house: HouseId): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.house, house);
  } catch {
    /* preferences are best-effort */
  }
}

export async function loadStudentProfile(): Promise<StudentProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.student);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StudentProfile;
    if (parsed?.id && parsed?.name && isHouse(parsed.house)) return parsed;
    return null;
  } catch {
    return null;
  }
}

export async function saveStudentProfile(
  profile: Omit<StudentProfile, 'id' | 'createdAt'> & { id?: string },
): Promise<StudentProfile> {
  const id = profile.id ?? (await ensureDeviceId());
  const stored: StudentProfile = {
    id,
    name: profile.name.trim(),
    house: profile.house,
    createdAt: Date.now(),
  };
  try {
    await AsyncStorage.setItem(KEYS.student, JSON.stringify(stored));
  } catch {
    /* best-effort */
  }
  return stored;
}

export async function clearStudentProfile(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEYS.student);
  } catch {
    /* noop */
  }
}

export async function loadOfficerSession(): Promise<OfficerSession | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.officer);
    if (!raw) return null;
    return JSON.parse(raw) as OfficerSession;
  } catch {
    return null;
  }
}

export async function saveOfficerSession(session: OfficerSession): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.officer, JSON.stringify(session));
  } catch {
    /* noop */
  }
}

export async function clearOfficerSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEYS.officer);
  } catch {
    /* noop */
  }
}

/** Officer unlock window — re-locks the panel after 4 hours of inactivity. */
export const OFFICER_SESSION_MS = 4 * 60 * 60 * 1000;

export function isOfficerSessionFresh(
  session: OfficerSession | null,
  now = Date.now(),
): boolean {
  return !!session && now - session.unlockedAt < OFFICER_SESSION_MS;
}

export { localBackend };
