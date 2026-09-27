import React from 'react';
import { ImageBackground, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { HouseId, HOUSES } from '../styles/theme';

type Props = React.PropsWithChildren<{
  house: HouseId;
  style?: StyleProp<ViewStyle>;
  imageOpacity?: number;
  overlayOpacity?: number;
}>;

export default function ThemedBackground({
  house,
  children,
  style,
  imageOpacity = 0.66,
  overlayOpacity = 0.94,
}: Props) {
  const theme = HOUSES[house];
  const darkAlpha = Math.round(overlayOpacity * 255).toString(16).padStart(2, '0');
  const midAlpha = Math.round(overlayOpacity * 0.77 * 255).toString(16).padStart(2, '0');

  return (
    <ImageBackground
      source={theme.image}
      resizeMode="cover"
      imageStyle={[styles.image, { opacity: imageOpacity }]}
      style={[styles.background, { backgroundColor: theme.deep }, style]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[`${theme.deep}${midAlpha}`, `${theme.deep}ba`, `${theme.deep}${darkAlpha}`]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={[styles.topGlow, { borderColor: `${theme.accent}12` }]} />
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, minHeight: '100%' },
  image: { opacity: 1 },
  topGlow: {
    position: 'absolute',
    top: -280,
    right: -120,
    width: 520,
    height: 520,
    borderWidth: 1,
    borderRadius: 260,
    opacity: 0.22,
  },
});
