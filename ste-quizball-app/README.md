# STE Quizball — Libertad National High School

Cross-platform mobile app (iOS & Android, plus web) for the LNHS STE
house competition: a live Quizball arena, house standings, and a weekly
bulletin board — wrapped in a classical Baroque oil-painting aesthetic
for the four houses: **Zeus**, **Poseidon**, **Athena**, **Aphrodite**.

- Frontend: **React Native (Expo)** + Expo Router + TypeScript
- Backend: **Firebase** — Realtime Database (live quiz state, `onValue`
  listeners, zero polling) + Firestore (bulletin board, `onSnapshot`)
- First-10 winners logic enforced by **atomic RTDB transactions**; the
  plaintext answer is never sent to clients (only a SHA-256 hash)

## 0. Run it in 2 minutes (demo mode, no backend needed)

```bash
cd ste-quizball-app
npm install
npx expo start
```

Then press `w` (web), `a` (Android emulator), `i` (iOS simulator), or
scan the QR code with **Expo Go**. Without Firebase keys the app runs in
**Demo Mode**: a local store mirrors the exact live-sync semantics so
every screen works on one device.

Officer panel seal: `STE_OFFICER_2026`

## 1. Connect Firebase (multi-device live sync)

1. Create a project at <https://console.firebase.google.com>
2. **Realtime Database** → Create database (region `asia-southeast1`
   recommended) → paste `database.rules.json` into the Rules tab
3. **Firestore Database** → Create database → paste `firestore.rules`
4. Project settings → **Your apps** → Web app → copy the config values
5. `cp .env.example .env` and fill in the `EXPO_PUBLIC_FIREBASE_*` values
6. Restart Expo (`npx expo start`) — the home footer flips to CONNECTED

## 2. Screens

| Route      | Purpose                                                        |
| ---------- | -------------------------------------------------------------- |
| `/`        | Landing: standings, house theme switcher, bulletin + filters   |
| `/display` | Landscape projector view: question, timer, X/10 counter, ranks |
| `/student` | Participant portal: name + house, live MCQ / short-answer     |
| `/admin`   | Officer sanctum (sealed): quiz manager + bulletin manager      |

## 3. How the First-10 logic works

All quiz state lives in ONE node — `ste2026/live` — co-locating the
question, `answerHash`, `responders`, `correctCount`, and `standings`
(`services/quizSync.ts`):

1. Student submits → answer is normalized (lowercase, trimmed, collapsed
   whitespace) and SHA-256 hashed on-device.
2. Pre-checks: buzzers open, timer unexpired, hash matches, no duplicate
   name, `correctCount < 10`.
3. A single `runTransaction` re-validates everything server-side and, on
   success, atomically appends the responder, bumps `correctCount`, and
   adds `pointValue` to the house total. Races resolve to exactly 10.
4. Need finals-grade security? Deploy the reference grader in
   `services/cloudFunction.example.js` (submissions queue + secret answer
   readable only by the function).

## 4. Project structure

```
app/            index.tsx  display.tsx  admin.tsx  student.tsx  _layout.tsx
components/     HouseStandings.tsx  BulletinCard.tsx  ThemedBackground.tsx
styles/         theme.ts            # 4 house palettes, Cinzel/Cormorant fonts
services/       firebaseConfig.ts   # init + demo-mode detection
                quizSync.ts         # RTDB listeners + first-10 transactions
                bulletinSync.ts     # Firestore CRUD + snapshots
                demoStore.ts        # zero-config local backend
                cloudFunction.example.js  # optional hardened grader
contexts/       ThemeContext.tsx    # global house theme (persisted)
assets/houses/  zeus/poseidon/athena/aphrodite oil-painting backdrops
```

## 5. Build & ship

```bash
npx expo export -p web        # static web build in dist/
eas build --platform all      # store builds (needs an EAS account)
```

Assets, fonts, and house artwork bundle automatically. Good luck, and may
the wisest house win. ❦
