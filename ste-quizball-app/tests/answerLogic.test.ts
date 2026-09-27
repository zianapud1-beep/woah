/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  The "first 10 correct answers score" contract.
 *
 *  These tests pin the exact rule shared by the client transaction
 *  (services/quizSync.ts), the offline classroom mirror
 *  (services/localBackend.ts) and the Cloud Function
 *  (functions/src/index.ts): a question can award points to at most
 *  MAX_RESPONDERS learners, every award is idempotent per student, and the
 *  house total only ever grows by the question's point value.
 *
 *  Run with:  npm test
 * ─────────────────────────────────────────────────────────────────────────────
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MAX_RESPONDERS,
  answerMatches,
  decideSubmission,
  emptyQuestion,
  makeOptions,
  normalizeAnswer,
} from '../services/answerLogic';
import type {
  ActiveQuestion,
  HouseId,
  HousePoints,
  SecureAnswer,
} from '../services/types';

/* ------------------------------------------------------------- fixtures */

const NOW = 1_700_000_000_000;

function multipleChoice(overrides: Partial<ActiveQuestion> = {}): ActiveQuestion {
  return {
    ...emptyQuestion('MULTIPLE_CHOICE', 1),
    id: 'q_test',
    text: 'Which particle carries the electromagnetic force?',
    options: makeOptions(['Gluon', 'Photon', 'W boson', 'Graviton']),
    pointValue: 10,
    ...overrides,
  };
}

function shortAnswer(overrides: Partial<ActiveQuestion> = {}): ActiveQuestion {
  return {
    ...emptyQuestion('SHORT_ANSWER', 7),
    id: 'q_short',
    text: 'Name the SI unit of pressure.',
    pointValue: 15,
    ...overrides,
  };
}

const secureMc: SecureAnswer = {
  questionId: 'q_test',
  answer: 'b',
  alternates: [],
  optionId: 'B',
};

const secureShort: SecureAnswer = {
  questionId: 'q_short',
  answer: 'pascal',
  alternates: ['pascals', 'pa'],
  optionId: null,
};

const points: HousePoints = {
  zeus: 20,
  poseidon: 30,
  athena: 40,
  aphrodite: 50,
};

const baseCtx = {
  correctResponderCount: 0,
  alreadyAnswered: false,
  housePoints: points,
  now: NOW,
};

/* --------------------------------------------------------------- normalise */

describe('normalizeAnswer', () => {
  it('trims, lowercases and collapses whitespace', () => {
    assert.equal(normalizeAnswer('  Bernoulli   LAW '), 'bernoulli law');
  });

  it('folds curly apostrophes', () => {
    assert.equal(normalizeAnswer("Ohm’s Law"), "ohm's law");
  });

  it('drops a trailing full stop and surrounding quotes', () => {
    assert.equal(normalizeAnswer('"Photon".'), 'photon');
  });

  it('is null safe', () => {
    assert.equal(normalizeAnswer(null), '');
    assert.equal(normalizeAnswer(undefined), '');
  });

  it('unifies scientific notation subscripts via NFKC', () => {
    // "CO₂" and "CO2" are the same molecule to a chemistry house.
    assert.equal(normalizeAnswer('CO₂'), normalizeAnswer('CO2'));
    assert.equal(normalizeAnswer('H2O'), 'h2o');
    // Superscripts fold too, so "m²" answers match "m2".
    assert.equal(normalizeAnswer('m²'), 'm2');
  });
});

describe('answerMatches', () => {
  it('matches a multiple choice option id case-insensitively', () => {
    assert.equal(answerMatches('b', secureMc), true);
    assert.equal(answerMatches('B', secureMc), true);
    assert.equal(answerMatches('c', secureMc), false);
  });

  it('matches the primary answer and every alternate', () => {
    assert.equal(answerMatches('Pascal', secureShort), true);
    assert.equal(answerMatches(' pascals ', secureShort), true);
    assert.equal(answerMatches('pa', secureShort), true);
    assert.equal(answerMatches('pascal.', secureShort), true);
    assert.equal(answerMatches('newton', secureShort), false);
  });

  it('rejects an empty submission', () => {
    assert.equal(answerMatches('   ', secureShort), false);
  });
});

/* -------------------------------------------------------------- decisions */

describe('decideSubmission', () => {
  it('refuses when there is no question', () => {
    const d = decideSubmission(
      { ...baseCtx, question: null, secure: null, candidate: 'photon' },
      'zeus',
    );
    assert.equal(d.status, 'NO_QUESTION');
    assert.equal(d.accept, false);
  });

  it('refuses when the secure answer belongs to another question', () => {
    const d = decideSubmission(
      {
        ...baseCtx,
        question: multipleChoice(),
        secure: { ...secureMc, questionId: 'q_other' },
        candidate: 'B',
      },
      'zeus',
    );
    assert.equal(d.status, 'NO_QUESTION');
  });

  it('refuses unless the buzzers are open', () => {
    for (const status of ['IDLE', 'PAUSED', 'TIME_UP', 'CLOSED', 'ANSWER_REVEALED'] as const) {
      const d = decideSubmission(
        {
          ...baseCtx,
          question: multipleChoice({ status }),
          secure: secureMc,
          candidate: 'B',
        },
        'zeus',
      );
      assert.equal(d.status, 'CLOSED', `status ${status} should reject`);
    }
  });

  it('refuses answers that arrive after the buzzer deadline', () => {
    const d = decideSubmission(
      {
        ...baseCtx,
        question: multipleChoice({ status: 'BUZZERS_OPEN', endsAt: NOW - 1 }),
        secure: secureMc,
        candidate: 'B',
      },
      'zeus',
    );
    assert.equal(d.status, 'CLOSED');
    assert.equal(d.accept, false);
  });

  it('refuses a second answer from the same student', () => {
    const d = decideSubmission(
      {
        ...baseCtx,
        question: multipleChoice({ status: 'BUZZERS_OPEN' }),
        secure: secureMc,
        alreadyAnswered: true,
        candidate: 'B',
      },
      'zeus',
    );
    assert.equal(d.status, 'DUPLICATE');
  });

  it('polite refusal for a wrong answer', () => {
    const d = decideSubmission(
      {
        ...baseCtx,
        question: multipleChoice({ status: 'BUZZERS_OPEN' }),
        secure: secureMc,
        candidate: 'Gluon',
      },
      'zeus',
    );
    assert.equal(d.status, 'INCORRECT');
    assert.equal(d.pointsAwarded, 0);
    assert.match(d.message, /marble statue/i);
  });

  it('accepts a correct answer and returns the new house total', () => {
    const d = decideSubmission(
      {
        ...baseCtx,
        question: multipleChoice({ status: 'BUZZERS_OPEN' }),
        secure: secureMc,
        candidate: 'b',
      },
      'athena',
    );
    assert.equal(d.status, 'CORRECT_ACCEPTED');
    assert.equal(d.accept, true);
    assert.equal(d.pointsAwarded, 10);
    assert.equal(d.houseTotal, 50); // 40 + 10
  });

  it('refuses the eleventh correct answer', () => {
    const d = decideSubmission(
      {
        ...baseCtx,
        question: multipleChoice({ status: 'BUZZERS_OPEN' }),
        secure: secureMc,
        correctResponderCount: MAX_RESPONDERS,
        candidate: 'B',
      },
      'zeus',
    );
    assert.equal(d.status, 'FULL');
    assert.equal(d.accept, false);
    assert.match(d.message, /first 10/i);
  });

  it('still accepts the tenth correct answer', () => {
    const d = decideSubmission(
      {
        ...baseCtx,
        question: multipleChoice({ status: 'BUZZERS_OPEN' }),
        secure: secureMc,
        correctResponderCount: MAX_RESPONDERS - 1,
        candidate: 'B',
      },
      'zeus',
    );
    assert.equal(d.status, 'CORRECT_ACCEPTED');
    assert.equal(d.accept, true);
  });
});

/* -------------------------------------------- a whole hall buzzing at once */

describe('a full hall of simultaneous buzzers', () => {
  it('awards exactly 10 questions worth of points and no more', () => {
    // Mirrors the Realtime Database transaction: each submission re-reads the
    // committed state, then either aborts (undefined) or writes.
    const question = shortAnswer({ status: 'BUZZERS_OPEN', endsAt: NOW + 30_000 });
    const secure = secureShort;

    const state = {
      question,
      secure,
      correctResponders: {} as Record<string, { house: HouseId }>,
      submissions: {} as Record<string, string>,
      housePoints: { ...points },
    };

    const houses: HouseId[] = ['zeus', 'poseidon', 'athena', 'aphrodite'];
    let accepted = 0;

    for (let i = 0; i < 40; i += 1) {
      const studentId = `stu_${i}`;
      const house = houses[i % 4] as HouseId;
      // 30 of the 40 buzz the right answer, 10 buzz nonsense.
      const candidate = i % 4 === 3 ? 'newton' : 'Pa.';

      const decision = decideSubmission(
        {
          question: state.question,
          secure: state.secure,
          correctResponderCount: Object.keys(state.correctResponders).length,
          alreadyAnswered: state.submissions[studentId] === question.id,
          candidate,
          housePoints: state.housePoints,
          now: NOW,
        },
        house,
      );

      if (decision.accept) {
        state.correctResponders[studentId] = { house };
        state.submissions[studentId] = question.id;
        state.housePoints = {
          ...state.housePoints,
          [house]: decision.houseTotal,
        };
        accepted += 1;
      }
    }

    assert.equal(accepted, MAX_RESPONDERS);
    assert.equal(Object.keys(state.correctResponders).length, MAX_RESPONDERS);

    // Every award is worth the question's point value — no drift, no doubles.
    const totalAwarded =
      points.zeus +
      points.poseidon +
      points.athena +
      points.aphrodite +
      accepted * question.pointValue;
    const runningTotal =
      state.housePoints.zeus +
      state.housePoints.poseidon +
      state.housePoints.athena +
      state.housePoints.aphrodite;
    assert.equal(runningTotal, totalAwarded);
  });

  it('never lets a house lose points through a wrong answer', () => {
    const before = { ...points };
    const d = decideSubmission(
      {
        ...baseCtx,
        question: shortAnswer({ status: 'BUZZERS_OPEN' }),
        secure: secureShort,
        candidate: 'pascal',
        correctResponderCount: MAX_RESPONDERS,
      },
      'aphrodite',
    );
    assert.equal(d.accept, false);
    assert.equal(d.houseTotal, before.aphrodite);
  });
});
