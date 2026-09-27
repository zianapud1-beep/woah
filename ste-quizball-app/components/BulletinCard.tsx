import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { HouseSigil, OrnateRule } from './index';
import { alpha, houseTheme, ink, radii, spacing, typography } from '@/styles/theme';
import { bulletinHouseToId, type BulletinPost } from '@/services/types';

/**
 * A single weekly-bulletin announcement: wax-seal house mark, gilt-framed
 * parchment card with a pinned ribbon for school-wide notices.
 */

const CATEGORY_COPY: Record<BulletinPost['category'], { label: string; icon: string }> = {
  EVENT: { label: 'EVENT', icon: 'calendar-outline' },
  ANNOUNCEMENT: { label: 'NOTICE', icon: 'megaphone-outline' },
  REMINDER: { label: 'REMINDER', icon: 'alarm-outline' },
  RESULT: { label: 'RESULT', icon: 'trophy-outline' },
};

function formatDate(iso: string, ts: number): string {
  const d = iso ? new Date(`${iso}T00:00:00`) : new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return d
    .toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
    .toUpperCase();
}

interface Props {
  post: BulletinPost;
  index?: number;
  onPress?: (post: BulletinPost) => void;
}

export function BulletinCard({ post, index = 0, onPress }: Props) {
  const house = bulletinHouseToId(post.house);
  const theme = house ? houseTheme(house) : null;
  const accent = theme?.primary ?? ink.gold;
  const cat = CATEGORY_COPY[post.category];

  return (
    <Pressable
      onPress={onPress ? () => onPress(post) : undefined}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${cat.label}: ${post.title}`}
      style={({ pressed }) => [
        styles.card,
        { borderColor: alpha(accent, 0.4), animation: undefined },
        pressed && onPress ? styles.pressed : null,
      ]}
    >
      {/* gilt inner rule */}
      <View style={[styles.innerRule, { borderColor: alpha(accent, 0.22) }]} pointerEvents="none" />

      <View style={styles.head}>
        <View style={[styles.seal, { borderColor: alpha(accent, 0.55) }]}>
          <LinearGradient
            colors={[alpha(accent, 0.35), 'rgba(8,8,12,0.9)']}
            style={StyleSheet.absoluteFill}
          />
          {theme ? (
            <HouseSigil house={theme.id} size={18} color={theme.accent} />
          ) : (
            <Ionicons name="school" size={16} color={ink.goldBright} />
          )}
        </View>

        <View style={styles.headText}>
          <View style={styles.tagRow}>
            <View style={[styles.tag, { borderColor: alpha(accent, 0.5) }]}>
              <Text style={[styles.tagText, { color: accent }]}>
                {post.house === 'ALL' ? 'ALL HOUSES' : theme?.name.toUpperCase()}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name={cat.icon as never} size={11} color={ink.ash} />
              <Text style={styles.meta}>{cat.label}</Text>
            </View>
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {post.title}
          </Text>
        </View>

        {post.pinned ? (
          <View style={styles.pin}>
            <Ionicons name="pin" size={12} color={ink.vellum} />
          </View>
        ) : null}
      </View>

      <OrnateRule color={alpha(accent, 0.35)} style={{ marginVertical: spacing.sm }} />

      <Text style={styles.body} numberOfLines={4}>
        {post.body}
      </Text>

      <View style={styles.foot}>
        <Text style={styles.footText}>{formatDate(post.eventDate, post.createdAt)}</Text>
        <View style={styles.dot} />
        <Text style={styles.footText} numberOfLines={1}>
          {post.createdBy}
        </Text>
        {index === 0 && post.pinned ? (
          <Text style={[styles.footText, { color: accent, marginLeft: 'auto' }]}>
            LATEST
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: 'rgba(10,12,20,0.82)',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  innerRule: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.lg,
    borderWidth: 1,
    margin: 3,
  },
  pressed: { opacity: 0.75 },
  head: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  seal: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headText: { flex: 1 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  tag: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  tagText: { fontFamily: typography.label, fontSize: 9, letterSpacing: 1.6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: {
    fontFamily: typography.label,
    color: ink.ash,
    fontSize: 9,
    letterSpacing: 1.4,
  },
  title: {
    fontFamily: typography.display,
    color: ink.vellum,
    fontSize: 16,
    letterSpacing: 0.6,
    marginTop: 4,
    lineHeight: 22,
  },
  pin: {
    backgroundColor: 'rgba(212,175,55,0.2)',
    borderRadius: radii.pill,
    padding: 5,
    transform: [{ rotate: '35deg' }],
  },
  body: {
    fontFamily: typography.body,
    color: ink.bone,
    fontSize: 14.5,
    lineHeight: 21,
  },
  foot: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  footText: {
    fontFamily: typography.label,
    color: ink.slate,
    fontSize: 10,
    letterSpacing: 1.4,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: ink.slate,
  },
});

export default BulletinCard;
