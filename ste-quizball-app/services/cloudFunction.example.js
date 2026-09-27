/**
 * OPTIONAL HARDENING — Cloud Function grader (reference implementation).
 *
 * The app already protects the answer with a one-way SHA-256 hash stored in
 * readable state, so students can prove correctness without ever seeing the
 * plaintext. For maximum-security events (finals, championships), deploy this
 * function and switch `submitAnswer` to the submissions-queue flow:
 *
 *   1. Client writes its attempt to:
 *        ste2026/submissions/{questionNumber}/{studentKey}
 *        { name, house, answer, at }
 *   2. This function (which CAN read the officer-only secret at
 *      ste2026/secret/{questionNumber}/answer) normalizes + compares,
 *      then runs the first-10 transaction on `ste2026/live`.
 *   3. The verdict is written back for the client to observe:
 *        ste2026/grades/{questionNumber}/{studentKey}
 *        { ok, code, position, points, at }
 *
 * Deploy: `firebase deploy --only functions` with firebase-admin + firebase-functions.
 */

// const { onValueCreated } = require('firebase-functions/v2/database');
// const { initializeApp } = require('firebase-admin/app');
// const { getDatabase } = require('firebase-admin/database');
//
// initializeApp();
//
// const MAX_WINNERS = 10;
// const normalize = (s) =>
//   String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
//
// exports.gradeSubmission = onValueCreated(
//   {
//     ref: '/ste2026/submissions/{qn}/{sid}',
//     region: 'asia-southeast1',
//   },
//   async (event) => {
//     const { qn, sid } = event.params;
//     const attempt = event.data.val() || {};
//     const rtdb = getDatabase();
//     const gradeRef = rtdb.ref(`ste2026/grades/${qn}/${sid}`);
//     const writeGrade = (g) => gradeRef.set({ ...g, at: Date.now() });
//
//     const [liveSnap, secretSnap] = await Promise.all([
//       rtdb.ref('ste2026/live').get(),
//       rtdb.ref(`ste2026/secret/${qn}/answer`).get(),
//     ]);
//     const live = liveSnap.val();
//     const secret = normalize(secretSnap.val());
//     if (!live || String(live.questionNumber) !== String(qn)) {
//       return writeGrade({ ok: false, code: 'NO_QUESTION' });
//     }
//     if (live.status !== 'BUZZERS_OPEN') {
//       return writeGrade({ ok: false, code: 'CLOSED' });
//     }
//     const name = normalize(attempt.name);
//     const dup = Object.values(live.responders || {}).some(
//       (r) => normalize(r.name) === name
//     );
//     if (dup) return writeGrade({ ok: false, code: 'DUPLICATE' });
//     if (normalize(attempt.answer) !== secret) {
//       return writeGrade({ ok: false, code: 'WRONG' });
//     }
//
//     const result = await rtdb.ref('ste2026/live').transaction((cur) => {
//       if (!cur || cur.status !== 'BUZZERS_OPEN') return; // abort
//       if ((cur.correctCount || 0) >= (cur.maxWinners || MAX_WINNERS)) return;
//       const position = (cur.correctCount || 0) + 1;
//       const responders = { ...(cur.responders || {}) };
//       responders[sid] = {
//         name: String(attempt.name).trim(),
//         house: attempt.house,
//         at: Date.now(),
//         position,
//       };
//       const standings = { ...(cur.standings || {}) };
//       standings[attempt.house] =
//         Math.max(0, standings[attempt.house] || 0) + (cur.pointValue || 0);
//       return { ...cur, responders, correctCount: position, standings };
//     });
//
//     if (!result.committed) {
//       return writeGrade({ ok: false, code: 'FULL' });
//     }
//     const updated = result.snapshot.val();
//     return writeGrade({
//       ok: true,
//       code: 'SUCCESS',
//       position: updated.correctCount,
//       points: updated.pointValue,
//     });
//   }
// );

module.exports = {};
