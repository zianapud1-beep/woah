import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { firestore, isFirebaseConfigured } from './firebaseConfig';
import {
  subscribeBulletins as subscribeDemoBulletins,
  addBulletin as addDemoBulletin,
  removeBulletin as removeDemoBulletin,
} from './demoStore';
import type { Bulletin } from './types';

/**
 * Weekly bulletin board over Firestore (`onSnapshot` — no polling).
 * Falls back to the DemoStore when Firebase is not configured.
 */

export function subscribeToBulletins(cb: (items: Bulletin[]) => void): () => void {
  if (!isFirebaseConfigured || !firestore) return subscribeDemoBulletins(cb);
  const q = query(collection(firestore, 'bulletins'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const items: Bulletin[] = snap.docs.map((d) => {
        const v = d.data() as Record<string, unknown>;
        const ts = v.createdAt as { toMillis?: () => number } | undefined;
        return {
          id: d.id,
          title: String(v.title || ''),
          body: String(v.body || ''),
          house: (v.house as Bulletin['house']) || 'ALL',
          eventDate: String(v.eventDate || ''),
          location: String(v.location || ''),
          author: String(v.author || 'STE Officers'),
          createdAt:
            ts && typeof ts.toMillis === 'function' ? ts.toMillis() : Date.now(),
        };
      });
      cb(items);
    },
    (err) => {
      console.warn('[bulletins] snapshot error:', err);
    }
  );
}

export async function createBulletin(
  data: Omit<Bulletin, 'id' | 'createdAt'>
): Promise<void> {
  const title = data.title.trim();
  const body = data.body.trim();
  if (!title || !body) throw new Error('Title and details are required.');
  if (!isFirebaseConfigured || !firestore) {
    addDemoBulletin({ ...data, title, body });
    return;
  }
  await addDoc(collection(firestore, 'bulletins'), {
    ...data,
    title,
    body,
    createdAt: serverTimestamp(),
  });
}

export async function removeBulletin(id: string): Promise<void> {
  if (!isFirebaseConfigured || !firestore) {
    removeDemoBulletin(id);
    return;
  }
  await deleteDoc(doc(firestore, 'bulletins', id));
}
