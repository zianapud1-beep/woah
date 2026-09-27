# woah — STE Quizball Olympus

Home of the **Libertad National High School STE Quizball** app: a
production-ready, cross-platform (iOS & Android + web) experience where
the four STE houses — **Zeus**, **Poseidon**, **Athena**, **Aphrodite** —
battle for glory in a live Quizball arena.

Everything lives in [`ste-quizball-app/`](ste-quizball-app/) — open its
[README](ste-quizball-app/README.md) for the full guide.

## Quick start

```bash
cd ste-quizball-app
npm install
npx expo start     # press w / a / i, or scan with Expo Go
```

- No backend setup needed: runs in **Demo Mode** out of the box.
- Officer seal: `STE_OFFICER_2026`
- Add Firebase keys (`.env`) for real multi-device live sync.

## What's inside

- `app/` — Landing, landscape Cast Display, Officer Panel, Answer Portal
- `services/` — Firebase RTDB first-10 transactions + Firestore bulletins
- `components/` + `styles/` — Baroque oil-painting design system
- `assets/houses/` — classical house artwork (storm, tide, owl, bloom)
