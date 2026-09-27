import React, { forwardRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { alpha, ink, radii, spacing, typography } from '@/styles/theme';

/** Engraved parchment field used throughout the officer console. */
export const FormField = forwardRef<TextInput, TextInputProps & {
  label: string;
  hint?: string;
  error?: string | null;
  trailing?: React.ReactNode;
}>(function FormField(
  { label, hint, error, trailing, style, ...props },
  ref,
) {
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {trailing}
      </View>
      <TextInput
        ref={ref}
        placeholderTextColor={ink.slate}
        selectionColor={ink.goldBright}
        {...props}
        style={[
          styles.input,
          !!error && styles.inputError,
          props.multiline && styles.inputMultiline,
          style,
        ]}
      />
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontFamily: typography.label,
    color: ink.bone,
    fontSize: 10,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: 'rgba(3,5,10,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: ink.vellum,
    fontFamily: typography.body,
    fontSize: 15.5,
  },
  inputMultiline: { minHeight: 92, textAlignVertical: 'top' },
  inputError: { borderColor: alpha('#E2553F', 0.7) },
  hint: {
    fontFamily: typography.script,
    color: ink.slate,
    fontSize: 11.5,
  },
  error: {
    fontFamily: typography.body,
    color: '#E2807A',
    fontSize: 12.5,
  },
});

export default FormField;
