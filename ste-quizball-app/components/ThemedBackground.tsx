import type { ReactNode } from 'react';
import {
  ImageBackground,
  StyleSheet,
  View,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useHouseTheme } from '../contexts/ThemeContext';

const BACKGROUNDS = {
  zeus: require('../assets/houses/zeus.jpg'),
  poseidon: require('../assets/houses/poseidon.jpg'),
  athena: require('../assets/houses/athena.jpg'),
  aphrodite: require('../assets/houses/aphrodite.jpg'),
};

/**
 * Full-screen classical canvas: house oil-painting artwork with a
 * chiaroscuro gradient veil so gold-leaf UI always stays legible.
 */
export default function ThemedBackground({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { house, theme } = useHouseTheme();
  const [g0, g1, g2] = theme.gradient;

  return (
    <ImageBackground
      source={BACKGROUNDS[house]}
      style={styles.bg}
      resizeMode="cover"
    >
      <LinearGradient
        colors={[`${g0}E8`, `${g1}DB`, `${g2}F4`]}
        style={styles.veil}
      >
        <View style={[styles.inner, style]}>{children}</View>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  veil: { flex: 1 },
  inner: { flex: 1 },
});
