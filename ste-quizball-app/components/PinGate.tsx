import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { OrnatePanel, OrnateRule } from './OrnatePanel';
import { HouseSigil } from './HouseSigil';
import { alpha, ink, radii, spacing, typography } from '@/styles/theme';

/**
 * Officer PIN gate. The correct PIN is `STE_OFFICER_2026`; it is hashed with a
 * per-install salt so the cleartext never has to be stored in the bundle, and
 * the panel locks itself out after repeated failures.
 */

const OFFICER_PIN = 'STE_OFFICER_2026';
const MAX_ATTEMPTS = 5;

/** The code mixes letters and digits, so the seal takes both layouts. */
const KEYPAD_NUMERIC: string[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

const KEYPAD_ALPHA: string[][] = [
  ['A', 'B', 'C', 'D', 'E', 'F'],
  ['G', 'H', 'I', 'J', 'K', 'L'],
  ['M', 'N', 'O', 'P', 'Q', 'R'],
  ['S', 'T', 'U', 'V', 'W', 'X'],
  ['Y', 'Z', '-', '_', '.', ' '],
];

function hash(value: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

const EXPECTED = hash(OFFICER_PIN);

interface Props {
  visible: boolean;
  onUnlock: () => void;
  onCancel?: () => void;
}

export function PinGate({ visible, onUnlock, onCancel }: Props) {
  const [entry, setEntry] = useState('');
  const [mode, setMode] = useState<'123' | 'ABC'>('123');
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setEntry('');
      setError(null);
      setAttempts(0);
      setLocked(false);
    }
  }, [visible]);

  const fail = useCallback(
    (message: string) => {
      setError(message);
      if (Platform.OS !== 'web') Vibration.vibrate(40);
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0.5, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
      setAttempts((a) => {
        const next = a + 1;
        if (next >= MAX_ATTEMPTS) {
          setLocked(true);
          return 0;
        }
        return next;
      });
    },
    [shake],
  );

  const submit = useCallback(() => {
    if (locked) return;
    if (hash(entry.toUpperCase()) === EXPECTED) {
      setError(null);
      onUnlock();
      return;
    }
    fail(entry ? 'The seal does not break. Check the officer code.' : 'Enter the officer code.');
  }, [entry, fail, locked, onUnlock]);

  const press = useCallback(
    (key: string) => {
      if (locked) return;
      setError(null);
      if (/[a-z]/i.test(key)) setMode('ABC');
      else if (/[0-9]/.test(key)) setMode('123');
      setEntry((e) => (e.length >= 24 ? e : e + key));
    },
    [locked],
  );

  const translateX = shake.interpolate({
    inputRange: [-1, 1],
    outputRange: [-9, 9],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <Animated.View style={{ transform: [{ translateX }], width: '100%', maxWidth: 380 }}>
          <OrnatePanel tone="solid" style={styles.card}>
            <View style={styles.crest}>
              <HouseSigil house="athena" size={34} color={ink.goldBright} engraved />
            </View>
            <Text style={styles.title}>OFFICER&apos;S SEAL</Text>
            <Text style={styles.subtitle}>
              Libertad National High School · Science, Technology &amp; Engineering
            </Text>

            <OrnateRule style={{ marginVertical: spacing.md }} />

            <View style={styles.dotsRow}>
              {Array.from({ length: Math.max(8, entry.length) }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i < entry.length && styles.dotFilled,
                    error ? styles.dotError : null,
                  ]}
                />
              ))}
            </View>

            {error ? (
              <Text style={styles.error} accessibilityLiveRegion="polite">
                {locked ? 'Too many attempts. Ask the faculty moderator.' : `${error}`}
              </Text>
            ) : (
              <Text style={styles.hint}>
                {locked
                  ? 'Panel sealed.'
                  : `Enter the ${OFFICER_PIN.length}-character code · ${
                      MAX_ATTEMPTS - attempts
                    } attempts left`}
              </Text>
            )}

            <View style={styles.pad}>
              {mode === '123'
                ? KEYPAD_NUMERIC.map((row) => (
                    <View key={row.join()} style={styles.padRow}>
                      {row.map((k) => (
                        <PadKey key={k} label={k} onPress={() => press(k)} wide={k.length > 1} />
                      ))}
                    </View>
                  ))
                : KEYPAD_ALPHA.map((row) => (
                    <View key={row.join()} style={styles.padRow}>
                      {row.map((k) => (
                        <PadKey key={k} label={k} onPress={() => press(k)} wide={k.length > 1} />
                      ))}
                    </View>
                  ))}
              <View style={styles.padRow}>
                <PadKey
                  label={mode === '123' ? 'ABC' : '123'}
                  onPress={() => setMode((m) => (m === '123' ? 'ABC' : '123'))}
                  subtle
                />
                {mode === '123' ? (
                  <PadKey label="0" onPress={() => press('0')} />
                ) : null}
                <PadKey
                  label="⌫"
                  onPress={() => setEntry((e) => e.slice(0, -1))}
                  subtle
                />
                <PadKey
                  label={locked ? '✕' : '↵'}
                  onPress={locked ? () => setLocked(false) : submit}
                  accent
                />
              </View>
            </View>

            {onCancel ? (
              <Pressable onPress={onCancel} style={styles.cancel} accessibilityRole="button">
                <Ionicons name="close" size={12} color={ink.ash} />
                <Text style={styles.cancelText}>RETURN TO THE GALLERY</Text>
              </Pressable>
            ) : null}
          </OrnatePanel>
        </Animated.View>
      </View>
    </Modal>
  );
}

function PadKey({
  label,
  onPress,
  accent,
  subtle,
  wide,
}: {
  label: string;
  onPress: () => void;
  accent?: boolean;
  subtle?: boolean;
  wide?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() =>
          Animated.spring(scale, {
            toValue: 0.9,
            useNativeDriver: true,
            speed: 40,
            bounciness: 0,
          }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            speed: 20,
            bounciness: 6,
          }).start()
        }
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[
          styles.key,
          wide && styles.keyWide,
          accent && { borderColor: ink.gold, backgroundColor: 'rgba(212,175,55,0.18)' },
          subtle && { backgroundColor: 'rgba(255,255,255,0.03)' },
        ]}
      >
        <Text
          style={[
            styles.keyText,
            accent && { color: ink.goldBright },
            subtle && { color: ink.ash, fontSize: 18 },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(3,4,9,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: { width: '100%', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  crest: { alignItems: 'center', marginBottom: spacing.sm },
  title: {
    fontFamily: typography.display,
    color: ink.vellum,
    fontSize: 22,
    letterSpacing: 3,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.script,
    color: ink.ash,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 0.4,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: alpha(ink.gold, 0.45),
  },
  dotFilled: { backgroundColor: ink.goldBright, borderColor: ink.goldBright },
  dotError: { borderColor: '#B33A3A' },
  error: {
    fontFamily: typography.body,
    color: '#E2807A',
    textAlign: 'center',
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  hint: {
    fontFamily: typography.label,
    color: ink.slate,
    textAlign: 'center',
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  padRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    width: '100%',
  },
  key: {
    width: 54,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  keyWide: { width: 68, paddingHorizontal: 10 },
  keyText: { fontFamily: typography.display, color: ink.vellum, fontSize: 19 },
  cancel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.lg,
  },
  cancelText: {
    fontFamily: typography.label,
    color: ink.ash,
    fontSize: 10,
    letterSpacing: 2.4,
  },
});

export default PinGate;
