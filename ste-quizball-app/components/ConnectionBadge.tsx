import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { alpha, ink, radii, spacing, typography } from '@/styles/theme';
import type { ConnectionState } from '@/services/types';

/**
 * Live-link indicator. Shows the transport (Realtime Database / Firestore)
 * and, in demo mode, offers a switch to simulate a dropped connection so the
 * degraded UI can be demonstrated before an event.
 */
export function ConnectionBadge({
  connection,
  onToggleDemoLink,
  compact = false,
}: {
  connection: ConnectionState;
  onToggleDemoLink?: () => void;
  compact?: boolean;
}) {
  const online = connection.online;
  const color = online ? '#7BE495' : '#E2553F';
  const label = online
    ? connection.mode === 'firebase'
      ? 'LIVE'
      : 'DEMO'
    : 'OFFLINE';

  return (
    <Pressable
      onPress={onToggleDemoLink}
      disabled={!onToggleDemoLink}
      accessibilityRole={onToggleDemoLink ? 'button' : 'text'}
      accessibilityLabel={`Connection ${label}`}
      accessibilityHint={onToggleDemoLink ? 'Toggle the simulated link' : undefined}
      style={[
        styles.badge,
        { borderColor: alpha(color, 0.5), backgroundColor: alpha(color, 0.12) },
        compact && { paddingVertical: 3, paddingHorizontal: 8 },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{label}</Text>
      {!compact ? (
        <Text style={styles.sub}>
          {connection.submissionMode === 'cloud-function' ? 'FN' : 'TXN'}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: {
    fontFamily: typography.label,
    fontSize: 10,
    letterSpacing: 2,
  },
  sub: {
    fontFamily: typography.label,
    color: ink.ash,
    fontSize: 8,
    letterSpacing: 1.4,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  noticeText: {
    flex: 1,
    fontFamily: typography.body,
    fontSize: 12.5,
    lineHeight: 17,
  },
});

/** Warning strip for degraded situations (rules locked, link lost, demo mode). */
export function NoticeStrip({
  message,
  tone = 'warn',
  icon = 'alert-circle',
}: {
  message: string;
  tone?: 'warn' | 'info';
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const color = tone === 'warn' ? '#F0B429' : ink.ash;
  return (
    <View
      style={[
        styles.notice,
        { borderColor: alpha(color, 0.4), backgroundColor: alpha(color, 0.1) },
      ]}
    >
      <Ionicons name={icon} size={14} color={color} />
      <Text style={[styles.noticeText, { color }]}>{message}</Text>
    </View>
  );
}

export default ConnectionBadge;
