import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { firestore } from './firebaseConfig';
import { ensureSignedIn } from './quizSync';
import { HouseFilter } from '../styles/theme';

export type Bulletin = {
  id: string;
  title: string;
  body: string;
  audience: HouseFilter;
  eventDate?: string;
  createdAt?: number;
};

export type BulletinInput = Omit<Bulletin, 'id' | 'createdAt'>;

const collectionName = 'bulletins';

export function subscribeBulletins(
  onChange: (bulletins: Bulletin[]) => void,
  onError?: (error: Error) => void,
) {
  if (!firestore) {
    onChange([]);
    return () => undefined;
  }
  const bulletinsQuery = query(collection(firestore, collectionName), orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(
    bulletinsQuery,
    (snapshot) => {
      const rows = snapshot.docs.map((document) => {
        const data = document.data();
        const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : undefined;
        const audience = typeof data.audience === 'string' ? data.audience as HouseFilter : 'ALL';
        return {
          id: document.id,
          title: typeof data.title === 'string' ? data.title : 'Untitled announcement',
          body: typeof data.body === 'string' ? data.body : '',
          audience,
          eventDate: typeof data.eventDate === 'string' ? data.eventDate : undefined,
          createdAt,
        } satisfies Bulletin;
      });
      onChange(rows);
    },
    (error) => onError?.(error),
  );
}

function assertBulletinInput(input: BulletinInput) {
  if (!input.title.trim()) throw new Error('Please add a bulletin title.');
  if (input.title.trim().length > 120) throw new Error('The bulletin title must be 120 characters or fewer.');
  if (!input.body.trim()) throw new Error('Please add bulletin details.');
  if (input.body.trim().length > 2000) throw new Error('Bulletin details must be 2,000 characters or fewer.');
}

export async function createBulletin(input: BulletinInput) {
  if (!firestore) throw new Error('Firebase is not configured for this build.');
  assertBulletinInput(input);
  await ensureSignedIn();
  const created = await addDoc(collection(firestore, collectionName), {
    title: input.title.trim(),
    body: input.body.trim(),
    audience: input.audience,
    eventDate: input.eventDate?.trim() || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return created.id;
}

export async function updateBulletin(id: string, input: BulletinInput) {
  if (!firestore) throw new Error('Firebase is not configured for this build.');
  assertBulletinInput(input);
  await ensureSignedIn();
  await updateDoc(doc(firestore, collectionName, id), {
    title: input.title.trim(),
    body: input.body.trim(),
    audience: input.audience,
    eventDate: input.eventDate?.trim() || null,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteBulletin(id: string) {
  if (!firestore) throw new Error('Firebase is not configured for this build.');
  await ensureSignedIn();
  await deleteDoc(doc(firestore, collectionName, id));
}
