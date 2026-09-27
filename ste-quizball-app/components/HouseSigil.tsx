import React from 'react';
import Svg, { G, Path, Circle } from 'react-native-svg';

import { HOUSES } from '@/styles/theme';
import type { HouseId } from '@/services/types';

interface Props {
  house: HouseId;
  size?: number;
  color?: string;
  /** Draws a second, larger outline for a gilded "engraved" look. */
  engraved?: boolean;
  strokeWidth?: number;
}

/**
 * The engraved house mark, drawn as vector paths so it stays crisp on the
 * 4K projector and scales with the gilded progress bars.
 */
export function HouseSigil({
  house,
  size = 24,
  color,
  engraved = false,
  strokeWidth = 1.2,
}: Props) {
  const theme = HOUSES[house];
  const tint = color ?? theme.accent;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {engraved ? (
        <G opacity={0.5}>
          <Path
            d={theme.sigil}
            stroke={tint}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
            transform="translate(0.6 0.8)"
          />
        </G>
      ) : null}
      <Path
        d={theme.sigil}
        stroke={tint}
        strokeWidth={engraved ? strokeWidth * 0.9 : strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx="12" cy="12" r="11" stroke={tint} strokeWidth={0.4} opacity={0.35} />
    </Svg>
  );
}

export default HouseSigil;
