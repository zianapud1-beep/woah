# Libertad STE Quizball

Cross-platform Expo / React Native application for the four-house Libertad National High School STE event. The app includes a live house leaderboard and weekly bulletin, a landscape projector display, an officer console, and a student answer portal. House artwork is original Baroque/Renaissance-inspired background art generated for this project.

## Stack

- Expo SDK 54, React Native, TypeScript, Expo Router
- Firebase Realtime Database for live question/timer/score state (`onValue`, no network polling)
- Cloud Functions for server-side answer evaluation and atomic first-ten scoring
- Firestore for the weekly bulletin board
- Firebase anonymous authentication for student sessions; officer access is elevated with a server-verified custom claim
- AsyncStorage for the selected house, student profile, and local response UX

## Run the app

Requirements: Node.js 20+, npm, and an Expo-supported iOS/Android device or simulator.

```sh
npm install
cp .env.example .env
# Fill in the Firebase client configuration values in .env
npx expo start
```

Use `npm run ios`, `npm run android`, or `npm run web` as needed. The home screen remains navigable without Firebase configuration, but live sync and submissions are disabled until the Firebase setup below is complete. Rebuild/restart the Expo app after changing `.env` values.

## Firebase setup

1. Create a Firebase project and register a Firebase **Web app** for the Expo client.
2. Enable **Anonymous** under Firebase Authentication → Sign-in method. This gives each installation a Firebase UID used to enforce one answer per UID per question.
3. Create a Realtime Database and a Cloud Firestore database. Copy the web app config into `.env`; use the exact Realtime Database URL shown in Firebase Console.
4. Copy `.firebaserc.example` to `.firebaserc` and replace `your-firebase-project-id` with the project ID. `.firebaserc` is intentionally not included so local project IDs are not accidentally committed.
5. Deploy the security rules and functions:

   ```sh
   firebase login
   firebase use <your-project-id>
   firebase deploy --only database,firestore:rules
   cd functions && npm install && npm run build && cd ..
   firebase functions:secrets:set OFFICER_PIN
   # When prompted, enter the event's officer PIN: STE_OFFICER_2026
   firebase deploy --only functions
   ```

   Cloud Functions and Secret Manager may require the Firebase project to be on the Blaze plan. Functions are deployed to `us-central1`, matching the client SDK configuration.
6. Confirm the RTDB contains the public nodes `/quizState/public` and `/quizState/standings` after a question/score is first written by an officer. The Cloud Functions Admin SDK is the only writer; students and officers do not write directly to the game state.

The `.env` client values are public app configuration, **not secrets**. The officer PIN is stored in Secret Manager and is never bundled into the app. Change the PIN in Secret Manager before a real event if the default value is not intended.

## Live game and security model

The readable RTDB branches are only:

- `/quizState/public` — current question, four options, timer metadata, status, score counter, and (only after an officer presses **Reveal answer**) the revealed answer.
- `/quizState/standings` — the four house totals.

`/quizState/private`, `/quizState/correct_responders`, and `/quizState/submissions` have no client read/write grant. The `publishQuestion`, `controlQuizTimer`, `setHousePoints`, and `revealQuizAnswer` callables require the `admin` custom claim, which is granted only after the server validates `OFFICER_PIN`. Bulletins are publicly readable and can be created, edited, or deleted only by a user with that claim.

Students submit through the `submitAnswer` callable. It normalizes answers on the server and runs a Realtime Database transaction against the common game-state node. The transaction verifies the current question, open buzzer/deadline, one submission per Firebase UID, and the ten-correct-response cap, then records the responder and increments the matching house total in the same atomic commit. The correct answer is kept out of public RTDB state until an officer explicitly reveals it. The display and student countdowns use a local one-second clock; no clients short-poll Firebase.

`database.rules.json` and `firestore.rules` are part of the security boundary. Deploy them before using the application; do not loosen the parent RTDB read/write rules. For stricter identity guarantees than one response per anonymous Firebase UID, connect school-issued accounts or another verified identity provider before a public event—anonymous accounts can be recreated by a determined user.

## Project map

```text
app/                  Expo Router screens: dashboard, projector, officer, student
components/           Reusable house, bulletin, and background UI
context/              Persistent global house theme
services/             Firebase init, live subscriptions, and client callable helpers
functions/src/        Trusted answer scoring and officer control functions
styles/theme.ts       House palette and visual identity
assets/images/        Original classical house background art
```

## Validation

```sh
npm run typecheck
cd functions && npm run build
```
