import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { HouseThemeProvider } from '../context/HouseThemeContext';
import { COLORS } from '../styles/theme';

export default function RootLayout() {
  return (
    <HouseThemeProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.ink },
          animation: 'fade',
        }}
      />
    </HouseThemeProvider>
  );
}
