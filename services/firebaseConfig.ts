import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuthModule from 'firebase/auth';
import { Auth, getAuth, initializeAuth } from 'firebase/auth';
import type { Persistence } from 'firebase/auth';
import { Database, getDatabase } from 'firebase/database';
import { Firestore, getFirestore } from 'firebase/firestore';
import { Functions, getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.databaseURL &&
  firebaseConfig.projectId &&
  firebaseConfig.appId,
);

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let realtimeDatabase: Database | null = null;
let firestore: Firestore | null = null;
let cloudFunctions: Functions | null = null;

// Firebase exposes this helper only from its React Native runtime entry point.
// Metro selects that entry on iOS/Android; the web entry intentionally omits it.
const getReactNativePersistence = (FirebaseAuthModule as unknown as {
  getReactNativePersistence?: (storage: typeof AsyncStorage) => Persistence;
}).getReactNativePersistence;

if (isFirebaseConfigured) {
  firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  if (Platform.OS === 'web') {
    firebaseAuth = getAuth(firebaseApp);
  } else if (getReactNativePersistence) {
    try {
      firebaseAuth = initializeAuth(firebaseApp, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } catch {
      // Fast refresh can initialize Auth before this module is re-evaluated.
      firebaseAuth = getAuth(firebaseApp);
    }
  } else {
    firebaseAuth = getAuth(firebaseApp);
  }
  realtimeDatabase = getDatabase(firebaseApp);
  firestore = getFirestore(firebaseApp);
  cloudFunctions = getFunctions(firebaseApp, 'us-central1');
}

export { firebaseApp, firebaseAuth, realtimeDatabase, firestore, cloudFunctions };
