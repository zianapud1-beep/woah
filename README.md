# Libertad National High School — STE Quizball

Cross-platform mobile app (iOS · Android) for the **STE Olympiad of Houses**:
a live quizball round, a real-time house scoreboard, a weekly bulletin board
and a PIN-protected officer console, synchronised through Firebase with push
updates — no short-polling anywhere.

```
ste-quizball-app/        ← the Expo + React Native application
├── app/                 screens (gallery · projector display · officer · buzzer)
├── components/          themed UI kit
├── styles/theme.ts      the classical oil-painting design system
├── services/            Firebase RTDB + Firestore sync, scoring logic
├── functions/           Cloud Function that keeps the answer server-side
└── tests/, scripts/     first-10 contract tests + headless render checks
```

**Start here → [`ste-quizball-app/README.md`](ste-quizball-app/README.md)**

```bash
cd ste-quizball-app
npm install
npm start          # works immediately in offline classroom mode
```

The four houses — **Zeus** (electromagnetism), **Poseidon** (fluid mechanics),
**Athena** (robotics & AI) and **Aphrodite** (chemistry & Fibonacci math) —
each carry their own classical oil-painting plate, palette and engraved sigil.
