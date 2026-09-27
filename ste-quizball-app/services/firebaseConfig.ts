import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';

/**
 * Firebase bootstrap.
 *
 * Configuration is read from `EXPO_PUBLIC_FIREBASE_*` environment variables
 * (inlined at build time) with a fallback to `app.config.ts → extra.firebase`,
 * so nothing secret is ever committed to the repository.
 */

type Maybe = string | undefined;

interface FirebaseExtra {
  apiKey?: Maybe;
  authDomain?: Maybe;
  databaseURL?: Maybe;
  projectId?: Maybe;
  storageBucket?: Maybe;
  messagingSenderId?: Maybe;
  appId?: Maybe;
}

function readExtra(): FirebaseExtra {
  const extra = (Constants.expoConfig?.extra ?? {}) as { firebase?: FirebaseExtra };
  return extra.firebase ?? {};
}

const env: FirebaseExtra = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfig = {
  apiKey: env.apiKey ?? readExtra().apiKey ?? '',
  authDomain: env.authDomain ?? readExtra().authDomain ?? '',
  databaseURL: env.databaseURL ?? readExtra().databaseURL ?? '',
  projectId: env.projectId ?? readExtra().projectId ?? '',
  storageBucket: env.storageBucket ?? readExtra().storageBucket ?? '',
  messagingSenderId: env.messagingSenderId ?? readExtra().messagingSenderId ?? '',
  appId: env.appId ?? readExtra().appId ?? '',
};

/** `true` when enough configuration is present to talk to a real project. */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

/** Root node for all quizball Realtime Database data. */
export const RTDB_ROOT = 'ste_event';

export const RTDB_PATHS = {
  session: `${RTDB_ROOT}/session`,
  question: `${RTDB_ROOT}/session/activeQuestion`,
  secureAnswer: `${RTDB_ROOT}/session/secureAnswer`,
  housePoints: `${RTDB_ROOT}/session/housePoints`,
  correctResponders: `${RTDB_ROOT}/session/correctResponders`,
  submissions: `${RTDB_ROOT}/session/submissions`,
  history: `${RTDB_ROOT}/session/history`,
  status: `${RTDB_ROOT}/session/status`,
} as const;

export const FIRESTORE_COLLECTION =
  process.env.EXPO_PUBLIC_FIRESTORE_COLLECTION ??
  ((Constants.expoConfig?.extra as { firestoreCollection?: string } | undefined)
    ?.firestoreCollection ??
  'bulletin_posts');

export const SUBMISSION_MODE_ENV =
  process.env.EXPO_PUBLIC_SUBMISSION_MODE ?? 'auto';

let app: FirebaseApp | null = null;
let db: Database | null = null;
let store: Firestore | null = null;
let fns: Functions | null = null;

/**
 * Lazily initialise Firebase. Returns `null` when the app has not been
 * configured, which lets the UI fall back to the offline demo backend.
 */
export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured) return null;
  if (app) return app;
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return app;
}

export function getRealtimeDatabase(): Database | null {
  const current = getFirebaseApp();
  if (!current) return null;
  if (db) return db;
  const url = firebaseConfig.databaseURL || `https://${firebaseConfig.projectId}.firebaseio.com`;
  db = getDatabase(current, url);
  return db;
}

export function getFirestoreStore(): Firestore | null {
  const current = getFirebaseApp();
  if (!current) return null;
  if (store) return store;
  store = getFirestore(current);
  return store;
}

export function getCloudFunctions(): Functions | null {
  const current = getFirebaseApp();
  if (!current) return null;
  if (fns) return fns;
  fns = getFunctions(current);
  return fns;
}

/** Reset every cached handle — used by tests and the "reconnect" action. */
export function resetFirebaseHandles(): void {
  app = null;
  db = null;
  store = null;
  fns = null;
}

export const platformNote =
  Platform.OS === 'web'
    ? 'Web preview — Firebase persistence uses the browser session.'
    : `Native (${Platform.OS}) — offline persistence is enabled on device.`;
