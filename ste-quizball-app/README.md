# STE Quizball — Libertad National High School

A production-ready cross-platform app (iOS · Android · web) for the **STE
Olympiad of Houses**: a live quizball round, a real-time house scoreboard, a
weekly bulletin board, and a PIN-protected officer console — all synchronised
through Firebase with **push, never polling**.

The visual language is a classical oil-painting salon: baroque chiaroscuro,
gilding, parchment and canvas, with each of the four houses backed by its own
masterpiece plate.

| House | Stream | Plate |
| --- | --- | --- |
| **Zeus** | Electromagnetism · Physics | storm clouds, golden lightning arcs, etched circuit filigree |
| **Poseidon** | Fluid Mechanics · Marine Science | churning teal ocean, sea-horse chariot, hydrodynamic grid |
| **Athena** | Robotics · AI · Computer Science | bronze portraiture, mechanical clockwork owl, sacred geometry |
| **Aphrodite** | Organic Chemistry · Fibonacci Math | crimson florals, glowing molecular bonds, golden spiral |

---

## 1. Quick start

```bash
cd ste-quizball-app
npm install
npm start            # Expo dev server — press i / a / w
```

With **no Firebase credentials** the app boots into its offline classroom
mirror: identical state shape, identical listeners, identical "first 10"
transaction, persisted to `AsyncStorage`. It is fully usable for a rehearsal or
a demo, and every screen works out of the box.

### Go live against Firebase

```bash
cp .env.example .env        # paste your project keys
npm start
```

Deploy the backend once (from this folder):

```bash
npm i -g firebase-tools
firebase login
firebase use --add                      # register ste-quizball-app as a project
firebase deploy --only database,firestore,functions
```

---

## 2. Project structure

```
ste-quizball-app/
├── app/                       Expo Router screens
│   ├── _layout.tsx            fonts, providers, navigator
│   ├── index.tsx              the gallery: standings · theme switcher · bulletin
│   ├── display.tsx            landscape projector board
│   ├── admin.tsx              officer console (PIN → 3 tabs)
│   └── student.tsx            the buzzer
├── components/
│   ├── ThemedBackground.tsx   plate + chiaroscuro scrim + house motif + grain
│   ├── HouseStandings.tsx     gilded animated leaderboard bars
│   ├── BulletinCard.tsx       wax-sealed announcement card
│   ├── HousePicker.tsx        house theme switcher (plate thumbnails)
│   ├── HouseSigil.tsx         vector house marks (bolt · wave · owl · spiral)
│   ├── OrnatePanel.tsx        gilded panel, rules, corner fleurons, wax seal
│   ├── CountdownRing.tsx      projector countdown with urgency pulse
│   ├── StatusBanner.tsx       BUZZERS OPEN · TIME UP · ANSWER REVEALED
│   ├── AppButton.tsx          gilded buttons + compact controls
│   ├── SegmentedControl.tsx   tabs and filter chips
│   ├── PinGate.tsx            officer PIN modal with lockout
│   ├── ConnectionBadge.tsx    LIVE / DEMO / OFFLINE indicator
│   ├── FormField.tsx          engraved inputs
│   ├── ScoreTicker.tsx        first-10 pips, house strip, rolling numbers
│   └── index.ts               barrel
├── styles/theme.ts            the entire design system (4 houses, type, gold)
├── services/
│   ├── firebaseConfig.ts      lazy Firebase init from EXPO_PUBLIC_* env
│   ├── quizSync.ts            RTDB listeners, officer commands, the transaction
│   ├── bulletinSync.ts        Firestore CRUD + onSnapshot feed
│   ├── answerLogic.ts         normalisation + the "first 10" decision
│   ├── localBackend.ts        offline mirror of the RTDB/Firestore contract
│   ├── preferences.ts         device-local student profile & house
│   └── types.ts               domain types
├── hooks/                     useQuizSync · useBulletin · useCountdown
├── context/ThemeProvider.tsx  global house selection
├── assets/houses/*.jpg        the four classical plates
├── functions/                 Cloud Function scoring service
├── tests/                     first-10 contract tests
└── scripts/smoke.mjs          headless render test for all four routes
```

---

## 3. Screens

### `app/index.tsx` — The Gallery
Live house standings as animated gilded bars, a **house theme switcher** (a
profile setting that repaints the whole app), the live question strip with the
first-10 counter, and the **weekly bulletin** as a `FlatList` of cards with
`ALL / ZEUS / POSEIDON / ATHENA / APHRODITE` filter chips. Portal cards open the
display, the student buzzer and the officer console.

### `app/display.tsx` — Quizball Display
Locked to landscape, kept awake, high contrast for a projector. Renders the
question number, the question text, the point value, the four options, the
countdown ring, the status banner and **"Correct Answers Received: X / 10"**
with ten pips, plus the running house tally along the bottom. A gold flash and
a gilt sweep mark `ANSWER REVEALED`. Tap anywhere to hide the chrome for a
clean cast.

### `app/admin.tsx` — Officer Console
PIN `STE_OFFICER_2026` (FNV-1a compared in-app; five wrong attempts seals the
panel for the session). Three tabs:

1. **QUIZBALL** — question type switch (`MULTIPLE_CHOICE` / `BLANK-SHORT`),
   question text, A–D options with a one-tap *mark as correct* control, the
   hidden answer with accepted alternates, point-value stepper, and a
   **PUSH TO DISPLAY** action. Timer presets 10 s / 30 s / 60 s, open, pause,
   reset, reveal, close, clear. The live board is shown above the builder.
2. **BULLETIN** — publish a weekly event (headline, body, audience, category,
   date, pin) and manage what is already published.
3. **TALLY** — manual point adjustments per house, scoreboard reset, and the
   backend diagnostics (transport + scoring mode).

### `app/student.tsx` — The Buzzer
Entry captures name + house (remembered on the device, never uploaded until a
buzz). Then the live question: four option buttons or a text field, haptics on
submit, a "sealing your answer" waiting graphic, and a result card that either
credits the house or politely explains the refusal — including the correct
answer once the officer reveals it.

---

## 4. The "first 10" rule

The cut-off lives in exactly one place, `services/answerLogic.ts`:

```ts
decideSubmission({ question, secure, correctResponderCount, alreadyAnswered,
                   candidate, housePoints, now }, house)
```

It returns `{ status, message, pointsAwarded, houseTotal, accept }` and is used
identically by the client transaction, the offline mirror and the Cloud
Function. The order of checks matters:

1. no question / answer belongs to another question → `NO_QUESTION`
2. status is not `BUZZERS_OPEN` → `CLOSED`
3. `endsAt` has passed → `CLOSED` *(the deadline is enforced even if the
   officer never pressed TIME UP)*
4. this student already answered this question → `DUPLICATE`
5. the normalised answer does not match → `INCORRECT`
6. `correctResponderCount >= 10` → `FULL`
7. otherwise **accept**: append the responder *and* increment the house total

### Submission paths

**A. Cloud Function (recommended).** `EXPO_PUBLIC_SUBMISSION_MODE=cloud-function`.
The client calls the callable `submitAnswer`; the correct answer lives only in
the Realtime Database under an officer-only node and is never sent to a phone.
One Admin SDK transaction does the read-check-write.

**B. Realtime Database transaction.** `EXPO_PUBLIC_SUBMISSION_MODE=transaction`.
`services/quizSync.ts → submitViaTransaction()` runs a `runTransaction()` on the
`ste_event/session` node. Because the question, the hidden answer, the
responder map and the house points are all children of that one node, the whole
read-check-write is atomic: with 40 phones buzzing at once the counter can never
overshoot 10. Deploy `database.rules.labmode.json` for this mode.

`auto` (the default) tries A and falls back to B if the function is not
deployed, surfacing the degradation in the connection badge.

### Why the answer is never in the student payload

`publishQuestion()` writes two separate nodes:

```
ste_event/session/activeQuestion   { id, index, text, type, options,
                                    pointValue, status, timerSeconds, endsAt … }
ste_event/session/secureAnswer     { questionId, answer, alternates, optionId }
```

`activeQuestion` is world-readable; `secureAnswer` is officer-only in
`database.rules.json`. The reveal writes the answer back into
`activeQuestion.revealedAnswer` **only** when the officer presses REVEAL, when
buzzers are already closed.

### Answer normalisation

`normalizeAnswer()` applies NFKC, trims, lowercases, folds curly apostrophes,
collapses whitespace, drops a trailing full stop and strips wrapping
quotes/brackets. NFKC also folds subscripts, so **"CO₂" and "CO2" match** —
handy for the Aphrodite chemistry round. Accepted alternates can be listed
comma-separated by the officer.

---

## 5. Security notes

| Concern | Handling |
| --- | --- |
| Hidden answer | Officer-only node, or kept entirely inside the Cloud Function |
| Point inflation | `labmode` rules cap every write at `+1` responder and at `+pointValue` per house; the strict rules forbid student writes entirely |
| Duplicate buzzing | `submissions/{studentId}` is checked inside the same transaction |
| Spamming the buzzer | the function throttles to 3 attempts / 2 s per device+id |
| Officer panel | PIN on-device, 5-attempt lockout, re-locks after 4 h; deploy with the `officer` custom claim for server-side enforcement |
| Bulletin writes | Firestore rules require the `officer` claim and validate field shapes |

### Locking down the officer panel (server side)

`database.rules.json` grants writes to `ste_event/_officers/{uid} === true`.
Promote faculty accounts with the included helper:

```bash
cd functions && npm install && npm run build
firebase functions:secrets:access …          # not required — uses an admin ID token
curl -X POST https://asia-southeast1-<project>.cloudfunctions.net/grantOfficerClaim \
  -H "Authorization: Bearer <ID token of a user with admin:true>" \
  -d '{"uid":"<auth uid>","officer":true}'
```

Until a claim exists, deploy `database.rules.labmode.json` (trusted classroom
mode) — the app detects the refusal and shows a notice instead of failing
silently.

---

## 6. Art direction

* `assets/houses/*.jpg` — four original oil-painting plates generated for this
  app (Zeus, Poseidon, Athena, Aphrodite), each keyed to that house's colours.
* `assets/grain.png` — a seamless canvas-grain tile multiplied over every screen
  at 7 % opacity for the painted texture.
* `components/ThemedBackground.tsx` layers, per screen: the plate → a slow
  ken-burns drift → a three-stop chiaroscuro scrim → an SVG house motif
  (lightning + circuit traces, hydrodynamic flow lines, sacred geometry,
  Fibonacci spiral with a molecular lattice) → the grain → a radial vignette.
* `styles/theme.ts` holds every token: `ink` (abyss → vellum), `typography`
  (Cinzel for engraved capitals, Marcellus for small caps, EB Garamond for body,
  IM Fell English for painted italic captions), gilding gradients, radii,
  chiaroscuro shadows and the four `HouseTheme` records.

Typefaces are bundled with `@expo-google-fonts/*` — no network needed at
runtime.

---

## 7. Quality gates

```bash
npm run typecheck   # tsc --noEmit, strict + noUncheckedIndexedAccess
npm test            # 19 tests: normalisation, decisions, the 10-buzzer cut-off
npm run build:web   # metro production bundle
npm run smoke       # boots the build in jsdom, asserts all 4 routes render
npm run smoke:dev   # dev-bundle DOM lint (needs `npm start` running)
npm run verify      # typecheck → test → build → smoke
```

`tests/answerLogic.test.ts` simulates a hall of 40 simultaneous buzzers (30
correct, 10 wrong) and asserts that exactly 10 are accepted, no student scores
twice, and the sum of all house totals equals `previous + 10 × pointValue`.

`scripts/smoke.mjs` loads the static web export in jsdom and checks that the
gallery, projector display, officer PIN gate and student portal all mount,
paint their copy and reference the classical plates — catching broken imports
and render crashes without a device. It also types the real officer PIN
(`STE_OFFICER_2026`, flipping the keypad layouts on the way) and asserts the
console opens.

`scripts/smoke-dev.mjs` repeats the walk against the **dev** bundle, where
React's DOM-nesting validation is active, so invalid HTML (for example a
`Pressable` nested inside another `Pressable`, which React Native Web renders
as a `<button>` inside a `<button>`) fails the lint instead of the browser.

---

## 8. Running on devices

```bash
npx expo start                  # then press i (iOS simulator) or a (Android)
npx expo run:ios                # native dev build
npx expo run:android
npx expo install ios            # prebuild the native projects for App Store / Play Store
```

Bundle identifiers: `edu.lnhs.stequizball` for both platforms. The display
screen calls `ScreenOrientation.lockAsync(LANDSCAPE)` and `KeepAwake` on mount
and restores portrait on exit; both are no-ops on web.
