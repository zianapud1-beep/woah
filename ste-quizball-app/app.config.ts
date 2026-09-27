import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Firebase is supplied through public environment variables so the same binary
 * can be pointed at the school project, a staging project, or left empty for
 * the fully offline "classical demo" mode.
 *
 *   EXPO_PUBLIC_FIREBASE_API_KEY
 *   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
 *   EXPO_PUBLIC_FIREBASE_DATABASE_URL
 *   EXPO_PUBLIC_FIREBASE_PROJECT_ID
 *   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
 *   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
 *   EXPO_PUBLIC_FIREBASE_APP_ID
 *
 * Optional tuning:
 *   EXPO_PUBLIC_SUBMISSION_MODE  "cloud-function" | "transaction" | "auto"
 *   EXPO_PUBLIC_RTDB_ROOT       Realtime Database root key (default: ste_event)
 *   EXPO_PUBLIC_FIRESTORE_COLLECTION (default: bulletin_posts)
 */

const env = process.env;

const firebaseExtra = {
  apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  databaseURL: env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ?? '',
  projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

const submissionMode = env.EXPO_PUBLIC_SUBMISSION_MODE ?? 'auto';
const rtdbRoot = env.EXPO_PUBLIC_RTDB_ROOT ?? 'ste_event';
const firestoreCollection =
  env.EXPO_PUBLIC_FIRESTORE_COLLECTION ?? 'bulletin_posts';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'STE Quizball',
  slug: 'ste-quizball-app',
  scheme: 'stequizball',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#080A12',
  primaryColor: '#0B0D14',
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'edu.lnhs.stequizball',
    buildNumber: '1',
  },
  android: {
    package: 'edu.lnhs.stequizball',
    versionCode: 1,
    adaptiveIcon: {
      backgroundColor: '#05070F',
      backgroundImage: './assets/android-icon-background.png',
      foregroundImage: './assets/android-icon-foreground.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
    output: 'single',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 220,
        resizeMode: 'contain',
        backgroundColor: '#080A12',
        dark: { backgroundColor: '#080A12' },
      },
    ],
    [
      'expo-screen-orientation',
      {
        initialOrientation: 'PORTRAIT_UP',
        screenOrientation: ['PORTRAIT_UP', 'LANDSCAPE_LEFT', 'LANDSCAPE_RIGHT'],
      },
    ],
  ],
  extra: {
    firebase: firebaseExtra,
    submissionMode,
    rtdbRoot,
    firestoreCollection,
  },
});
