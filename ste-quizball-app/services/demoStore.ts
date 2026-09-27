import {
  Bulletin,
  LiveState,
  defaultLiveState,
} from './types';

/**
 * DemoStore — zero-config local backend.
 *
 * Mirrors the Firebase Realtime Database + Firestore shape in memory and
 * notifies subscribers synchronously, so every screen (standings, quiz,
 * bulletin) behaves exactly as it will against real Firebase. Used
 * automatically whenever Firebase credentials are absent.
 */

// ---------------------------------------------------------------- live ---
let live: LiveState = {
  ...defaultLiveState(),
  standings: { zeus: 120, poseidon: 95, athena: 140, aphrodite: 110 },
};

type LiveListener = (state: LiveState) => void;
const liveListeners = new Set<LiveListener>();

function emitLive() {
  liveListeners.forEach((cb) => {
    try {
      cb(live);
    } catch {
      /* listener errors must not break the store */
    }
  });
}

export function getLiveSnapshot(): LiveState {
  return live;
}

export function subscribeLive(cb: LiveListener): () => void {
  liveListeners.add(cb);
  cb(live);
  return () => {
    liveListeners.delete(cb);
  };
}

export function updateLive(patch: Partial<LiveState>): LiveState {
  live = { ...live, ...patch, updatedAt: Date.now() };
  emitLive();
  return live;
}

export function replaceLive(next: LiveState): LiveState {
  live = { ...next, updatedAt: Date.now() };
  emitLive();
  return live;
}

export type TxnOutcome =
  | { ok: true; next: LiveState }
  | { ok: false; reason: string };

/** Demo equivalent of an RTDB transaction: atomic read-modify-write. */
export function transactionLive(
  fn: (draft: LiveState) => TxnOutcome
): { committed: boolean; reason?: string; live: LiveState } {
  const clone: LiveState = JSON.parse(JSON.stringify(live)) as LiveState;
  const outcome = fn(clone);
  if (!outcome.ok) {
    return { committed: false, reason: outcome.reason, live };
  }
  live = { ...outcome.next, updatedAt: Date.now() };
  emitLive();
  return { committed: true, live };
}

// ----------------------------------------------------------- bulletins ---
const now = Date.now();
let bulletins: Bulletin[] = [
  {
    id: 'demo-1',
    title: 'Opening Ceremony & Torch Parade',
    body: 'All four houses assemble at the Grandstand for the lighting of the STE flame. House banners, cheers, and the first standings reveal of the season!',
    house: 'ALL',
    eventDate: 'Mon • Oct 6 • 8:00 AM',
    location: 'Libertad NHS Grandstand',
    author: 'STE Officers',
    createdAt: now - 1000,
  },
  {
    id: 'demo-2',
    title: 'Electromagnetism Trials',
    body: 'Zeus challengers: coil-building sprint and a lightning-round quiz on circuits. Bring your multimeters and your courage.',
    house: 'ZEUS',
    eventDate: 'Tue • Oct 7 • 1:00 PM',
    location: 'Physics Laboratory 2',
    author: 'House Zeus',
    createdAt: now - 7200 * 1000,
  },
  {
    id: 'demo-3',
    title: 'Buoyancy Regatta',
    body: 'Poseidon crews race self-built hulls across the pool. Points for speed, stability, and style. Hydrodynamic grids provided.',
    house: 'POSEIDON',
    eventDate: 'Wed • Oct 8 • 9:00 AM',
    location: 'School Pool',
    author: 'House Poseidon',
    createdAt: now - 14400 * 1000,
  },
  {
    id: 'demo-4',
    title: 'Robotics Rumble Qualifiers',
    body: 'Athena line-followers and sumo bots face off in the ICT Hall. Clockwork owls welcome. Code freeze one hour before bouts.',
    house: 'ATHENA',
    eventDate: 'Thu • Oct 9 • 2:00 PM',
    location: 'ICT Hall',
    author: 'House Athena',
    createdAt: now - 21600 * 1000,
  },
  {
    id: 'demo-5',
    title: 'Fibonacci Garden Build',
    body: 'Aphrodite artists plant the golden-spiral garden and unveil molecular floral sculptures. Gloves and golden ratios provided.',
    house: 'APHRODITE',
    eventDate: 'Fri • Oct 10 • 8:00 AM',
    location: 'Science Garden',
    author: 'House Aphrodite',
    createdAt: now - 28800 * 1000,
  },
];

type BulletinListener = (items: Bulletin[]) => void;
const bulletinListeners = new Set<BulletinListener>();

function emitBulletins() {
  const sorted = [...bulletins].sort((a, b) => b.createdAt - a.createdAt);
  bulletinListeners.forEach((cb) => {
    try {
      cb(sorted);
    } catch {
      /* ignore */
    }
  });
}

export function subscribeBulletins(cb: BulletinListener): () => void {
  bulletinListeners.add(cb);
  cb([...bulletins].sort((a, b) => b.createdAt - a.createdAt));
  return () => {
    bulletinListeners.delete(cb);
  };
}

export function addBulletin(
  data: Omit<Bulletin, 'id' | 'createdAt'>
): Bulletin {
  const item: Bulletin = {
    ...data,
    id: `demo-${Date.now()}`,
    createdAt: Date.now(),
  };
  bulletins = [item, ...bulletins];
  emitBulletins();
  return item;
}

export function removeBulletin(id: string): void {
  bulletins = bulletins.filter((b) => b.id !== id);
  emitBulletins();
}
