/**
 * Headless render smoke test.
 *
 * Boots the static web export inside jsdom — once per route — and asserts
 * that every screen of the app actually mounts and paints: the classical
 * gallery, the projector display, the officer PIN gate and the student
 * buzzer portal.
 *
 *   npm run build:web && npm run smoke
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';

const DIST = process.env.SMOKE_DIST ?? '/tmp/webbuild';
const indexPath = join(DIST, 'index.html');

if (!existsSync(indexPath)) {
  console.error(`✗ No web export at ${DIST}. Run: npm run build:web`);
  process.exit(1);
}

const html = readFileSync(indexPath, 'utf8');
const bundleSrc = html.match(/src="([^"]*entry[^"]*\.js)"/)?.[1];
if (!bundleSrc) {
  console.error('✗ No web bundle referenced by index.html');
  process.exit(1);
}
const code = readFileSync(join(DIST, bundleSrc.replace(/^\//, '')), 'utf8');

/** route → strings that must be on screen once React has settled. */
const ROUTES = [
  {
    route: '/',
    title: 'gallery dashboard',
    expect: [
      'STE QUIZBALL',
      'LIBERTAD NATIONAL HIGH SCHOOL',
      'HOUSE STANDINGS',
      'YOUR HOUSE THEME',
      'WEEKLY BULLETIN',
      'ENTER THE EVENT',
      'ZEUS',
      'POSEIDON',
      'ATHENA',
      'APHRODITE',
      'Electromagnetism',
      'ON THE BOARD NOW',
      'correct answers banked',
      'STE Week Opening Rite',
      'DEMO',
    ],
  },
  {
    route: '/display',
    title: 'projector display',
    expect: [
      'QUESTION',
      'CORRECT ANSWERS RECEIVED',
      'correct buzzers score',
      'SECONDS',
      'HALL',
    ],
  },
  {
    route: '/admin',
    title: 'officer console (locked)',
    expect: ["OFFICER'S SEAL", 'character code', 'GALLERY'],
  },
  {
    route: '/student',
    title: 'student portal',
    expect: ['THE BUZZER', 'YOUR NAME', 'YOUR HOUSE', 'ENTER THE ARENA'],
  },
];

const IGNORABLE = /Not implemented|Could not parse CSS|WebSocket|net::ERR|timeout exceeded|Could not load (script|link|img)/i;

async function renderRoute({ route, title, expect }) {
  let failures = 0;
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => errors.push(String(e.message)));
  virtualConsole.on('error', (...a) => errors.push(a.map(String).join(' ')));

  const dom = new JSDOM(html, {
    url: `http://localhost${route}`,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(w) {
      // Browser APIs the React Native Web renderer expects.
      w.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
      w.IntersectionObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
      w.matchMedia = (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: () => false,
      });
      w.scrollTo = () => {};
      w.Audio = class {
        play() {
          return Promise.resolve();
        }
        pause() {}
      };

      // jsdom cannot measure text, which would make the web-font loader time
      // out. Pretend the device is not an Apple browser and resolve loads.
      Object.defineProperty(w.navigator, 'vendor', {
        value: 'Google Inc.',
        configurable: true,
      });
      Object.defineProperty(w.document, 'fonts', {
        value: {
          load: () => Promise.resolve([{}]),
          add() {},
          delete() {},
          check: () => true,
          forEach() {},
          ready: Promise.resolve(),
        },
        configurable: true,
      });
    },
  });

  const { window } = dom;
  window.addEventListener('error', (e) => errors.push(String(e.message)));

  try {
    window.eval(code);
  } catch (err) {
    errors.push(String(err?.stack ?? err));
  }

  // Let React flush, fonts settle and the offline mirror hydrate.
  await new Promise((resolve) => setTimeout(resolve, 2200));

  const missingExtra = [];
  const body = (window.document.body.textContent ?? '').replace(/\s+/g, ' ');
  let markup = window.document.getElementById('root')?.innerHTML ?? '';

  // ── interactive drill: unlock the officer console with the real PIN ─────
  if (route === '/admin') {
    // React Native Web's press responder needs the full pointer sequence.
    const click = async (label) => {
      const el = window.document.querySelector(`[aria-label="${label}"]`);
      if (!el) throw new Error(`no control labelled "${label}"`);
      for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
        el.dispatchEvent(
          new window.MouseEvent(type, { bubbles: true, cancelable: true, button: 0 }),
        );
      }
      await new Promise((r) => setTimeout(r, 40));
    };

    const has = (label) => !!window.document.querySelector(`[aria-label="${label}"]`);

    // Type the code the way an officer would: flip the layout whenever the
    // next character is not on the current keypad.
    for (const key of 'STE_OFFICER_2026') {
      if (!has(key)) {
        const toggle = has('ABC') ? 'ABC' : '123';
        // eslint-disable-next-line no-await-in-loop
        await click(toggle);
      }
      // eslint-disable-next-line no-await-in-loop
      await click(key);
    }
    await click('↵');
    await new Promise((r) => setTimeout(r, 700));

    markup = window.document.getElementById('root')?.innerHTML ?? '';
    const after = (window.document.body.textContent ?? '').replace(/\s+/g, ' ');
    for (const needle of [
      'OFFICER CONSOLE',
      'QUIZBALL',
      'BULLETIN',
      'TALLY',
      'NEW QUESTION',
      'BUZZER CONTROL',
      'PUSH TO DISPLAY',
      'PRESET DURATION',
    ]) {
      if (!after.includes(needle)) {
        console.log(`      ✗ officer console missing "${needle}"`);
        failures += 1;
      }
    }
    if (failures === 0) {
      console.log('      ✓ /admin unlocks with STE_OFFICER_2026');
    }
  }

  // Every route must mount at least one of the four classical plates.
  if (title === 'gallery dashboard') {
    for (const plate of ['zeus', 'poseidon', 'athena', 'aphrodite']) {
      if (!markup.includes(plate)) {
        missingExtra.push(`plate:${plate}`);
      }
    }
  }

  const missing = expect.filter((needle) => !body.includes(needle));
  const fatal = errors.filter((e) => !IGNORABLE.test(e));

  console.log(`\n  ${route}  —  ${title}`);
  for (const needle of expect) {
    const ok = body.includes(needle);
    if (!ok) console.log(`      ✗ missing "${needle}"`);
  }
  for (const e of fatal.slice(0, 4)) {
    console.log(`      ✗ ${e.slice(0, 220)}`);
    failures += 1;
  }

  for (const extra of missingExtra) console.log(`      ✗ missing ${extra}`);

  const passed =
    failures === 0 &&
    missing.length === 0 &&
    missingExtra.length === 0 &&
    fatal.length === 0 &&
    markup.length > 2000;
  console.log(
    passed
      ? `      ✓ renders (${markup.length} chars of DOM, ${expect.length} checks)`
      : `      ✗ FAILED — ${missing.length} missing, ${failures} errors`,
  );

  window.close();
  return passed;
}

console.log('\nSTE Quizball — headless render smoke test');

let ok = true;
for (const route of ROUTES) {
  // Sequential: jsdom is single threaded per instance and we want stable logs.
  // eslint-disable-next-line no-await-in-loop
  const passed = await renderRoute(route);
  ok = ok && passed;
}

console.log(
  `\n${ok ? '✓ all routes render' : '✗ one or more routes failed to render'}\n`,
);
process.exit(ok ? 0 : 1);
