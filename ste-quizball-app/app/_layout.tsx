import React, { useCallback, useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Cinzel_400Regular, Cinzel_700Bold, Cinzel_800ExtraBold, Cinzel_900Black } from '@expo-google-fonts/cinzel';
import { Marcellus_400Regular } from '@expo-google-fonts/marcellus';
import {
  IMFellEnglish_400Regular,
  IMFellEnglish_400Regular_Italic,
} from '@expo-google-fonts/im-fell-english';
import {
  EBGaramond_400Regular,
  EBGaramond_500Medium,
  EBGaramond_600SemiBold,
  EBGaramond_700Bold,
} from '@expo-google-fonts/eb-garamond';
import { ink } from '@/styles/theme';

import { ThemeProvider } from '@/context/ThemeProvider';
import { localBackend } from '@/services/localBackend';

/**
 * Root layout — loads the classical typefaces, hydrates the offline mirror
 * (when Firebase is not configured) and mounts the tab/stack navigator.
 */

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Cinzel_400Regular,
    Cinzel_700Bold,
    Cinzel_800ExtraBold,
    Cinzel_900Black,
    Marcellus_400Regular,
    IMFellEnglish_400Regular,
    IMFellEnglish_400Regular_Italic,
    EBGaramond_400Regular,
    EBGaramond_500Medium,
    EBGaramond_600SemiBold,
    EBGaramond_700Bold,
  });

  useEffect(() => {
    // Bring the offline classroom mirror online so the demo is populated.
    void localBackend.hydrate();
  }, []);

  const onLayout = useCallback(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={styles.root} onLayout={onLayout}>
      <SafeAreaProvider>
        <ThemeProvider>
          <StatusBar style="light" />
          <View style={styles.root}>
            <Stack
              screenOptions={{
                headerShown: false,
                animation: 'fade',
                contentStyle: { backgroundColor: ink.abyss },
              }}
            >
              <Stack.Screen name="index" options={{ title: 'Quizball' }} />
              <Stack.Screen
                name="display"
                options={{ title: 'Quizball Display', animation: 'fade' }}
              />
              <Stack.Screen name="admin" options={{ title: 'Officer Panel' }} />
              <Stack.Screen name="student" options={{ title: 'Student Portal' }} />
            </Stack>
          </View>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ink.abyss,
    ...Platform.select({ web: { overflow: 'hidden' }, default: {} }),
  },
});
