import { useEffect, useMemo, useState } from 'react';

import { postsForHouse, subscribeToBulletin } from '@/services/bulletinSync';
import type { BulletinHouse, BulletinPost } from '@/services/types';

export type BulletinFilter = BulletinHouse;

/** Live bulletin feed (Firestore `onSnapshot`) with a local filter chip. */
export function useBulletin(filter: BulletinFilter) {
  const [posts, setPosts] = useState<BulletinPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToBulletin((next) => {
      setPosts(next);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const visible = useMemo(() => postsForHouse(posts, filter), [posts, filter]);

  return { posts, visible, loading, total: posts.length };
}
