import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

import { FIRESTORE_COLLECTION, getFirestoreStore, isFirebaseConfigured } from './firebaseConfig';
import { localBackend } from './localBackend';
import type { BulletinPost, BulletinHouse } from './types';

/**
 * Weekly bulletin — Firestore CRUD.
 *
 * The officer publishes from `app/admin.tsx`; every device receives the list
 * through `onSnapshot` (push, never polled). Filter chips in the dashboard are
 * applied client-side so switching between ALL and a single house is instant.
 */

/* ------------------------------------------------------------- normalising */

const VALID_HOUSES: BulletinHouse[] = [
  'ALL',
  'ZEUS',
  'POSEIDON',
  'ATHENA',
  'APHRODITE',
];

function toPost(id: string, data: DocumentData): BulletinPost {
  const house = VALID_HOUSES.includes(data.house) ? data.house : 'ALL';
  const category = (
    ['EVENT', 'ANNOUNCEMENT', 'REMINDER', 'RESULT'] as const
  ).includes(data.category)
    ? data.category
    : 'ANNOUNCEMENT';
  return {
    id,
    title: String(data.title ?? 'Untitled notice'),
    body: String(data.body ?? ''),
    house,
    category,
    eventDate: String(data.eventDate ?? ''),
    pinned: Boolean(data.pinned),
    createdAt: Number(data.createdAt?.toMillis?.() ?? data.createdAt ?? 0),
    createdBy: String(data.createdBy ?? 'Officer'),
  };
}

function sortPosts(posts: BulletinPost[]): BulletinPost[] {
  return [...posts].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.createdAt - a.createdAt;
  });
}

/* --------------------------------------------------------------- listeners */

/** Stream the whole bulletin. Returns an unsubscribe function. */
export function subscribeToBulletin(
  listener: (posts: BulletinPost[]) => void,
): () => void {
  const store = getFirestoreStore();
  if (!store) return localBackend.subscribeBulletin(listener);

  try {
    const q = query(
      collection(store, FIRESTORE_COLLECTION),
      orderBy('createdAt', 'desc'),
    );
    return onSnapshot(
      q,
      (snap) => {
        const posts = snap.docs.map((d: QueryDocumentSnapshot) =>
          toPost(d.id, d.data()),
        );
        listener(sortPosts(posts));
      },
      (error) => {
        console.warn('[bulletinSync] listener error', error.message);
        listener([]);
      },
    );
  } catch (error) {
    console.warn('[bulletinSync] falling back to offline bulletin', error);
    return localBackend.subscribeBulletin(listener);
  }
}

/* ------------------------------------------------------------------- CRUD */

export type NewBulletinPost = Omit<BulletinPost, 'id' | 'createdAt'>;

export async function publishBulletinPost(
  post: NewBulletinPost,
): Promise<{ id: string }> {
  const store = getFirestoreStore();
  if (!store) {
    const created = await localBackend.publishPost(post);
    return { id: created.id };
  }
  const refDoc = await addDoc(collection(store, FIRESTORE_COLLECTION), {
    ...post,
    house: post.house,
    createdAt: new Date(),
  });
  return { id: refDoc.id };
}

export async function deleteBulletinPost(id: string): Promise<void> {
  const store = getFirestoreStore();
  if (!store) return void localBackend.deletePost(id);
  await deleteDoc(doc(store, FIRESTORE_COLLECTION, id));
}

export async function setBulletinPinned(
  id: string,
  pinned: boolean,
): Promise<void> {
  const store = getFirestoreStore();
  if (!store) return void localBackend.setPinned(id, pinned);
  await updateDoc(doc(store, FIRESTORE_COLLECTION, id), { pinned });
}

/** Fire-and-forget convenience for the "house-only" filter chips. */
export function postsForHouse(
  posts: BulletinPost[],
  house: BulletinHouse,
): BulletinPost[] {
  if (house === 'ALL') return posts;
  // A house filter keeps that house's notices plus pinned school-wide news.
  return posts.filter((p) => p.house === house || (p.house === 'ALL' && p.pinned));
}

export const bulletinBackendLabel = isFirebaseConfigured
  ? 'Firestore'
  : 'Offline mirror';
