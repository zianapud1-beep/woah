/**
 * Dev-bundle DOM lint.
 *
 * The production smoke test (`smoke.mjs`) cannot see React's DOM-nesting
 * validation, which only runs in development. This script boots the *dev*
 * bundle from `npx expo start` in jsdom, walks every route — unlocking the
 * officer console and signing a student in along the way — and fails on any
 * nesting or render error.
 *
 *   npm start          # in one terminal
 *   npm run smoke:dev  # in another
 */
import { JSDOM, VirtualConsole } from 'jsdom';

const ORIGIN = process.env.SMOKE_ORIGIN ?? 'http://localhost:8081';
const BUNDLE =
  '/node_modules/expo-router/entry.bundle?platform=web&dev=true&hot=false&lazy=true' +
  '&transform.engine=hermes&transform.routerRoot=app&unstable_transformProfile=hermes-stable';

/**
 * Platform/framework chatter that is not a defect: jsdom has no native
 * animation module, and RNW 0.21 deprecates shadow* / pointerEvents props.
 */
const IGNORABLE =
  /useNativeDriver|shadow\*|pointerEvents is deprecated|Require cycle|Not implemented|Could not parse CSS|WebSocket|net::ERR/i;

async function boot(route) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => errors.push(String(e.message)));
  virtualConsole.on('error', (...a) => errors.push(a.map(String).join(' ')));
  virtualConsole.on('warn', (...a) => {
    const msg = a.map(String).join(' ');
    if (!IGNORABLE.test(msg)) errors.push(`WARN ${msg}`);
  });

  const dom = new JSDOM(
    '<!doctype html><html><head></head><body><div id="root"></div></body></html>',
    {
      url: `${ORIGIN}${route}`,
      runScripts: 'dangerously',
      resources: 'usable',
      pretendToBeVisual: true,
      virtualConsole,
      beforeParse(w) {
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
          addListener() {},
          removeListener() {},
          addEventListener() {},
          removeEventListener() {},
          dispatchEvent: () => false,
        });
        w.scrollTo = () => {};
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
    },
  );

  const { window } = dom;
  const script = window.document.createElement('script');
  script.src = BUNDLE;
  window.document.body.appendChild(script);
  await new Promise((r) => setTimeout(r, 26000));

  const api = {
    window,
    doc: window.document,
    text: () => (window.document.body.textContent ?? '').replace(/\s+/g, ' '),
    byLabel: (label) =>
      window.document.querySelector(`[aria-label="${label}"]`),
    has: (label) => !!api.byLabel(label),
    async press(label) {
      const el = api.byLabel(label);
      if (!el) throw new Error(`no control labelled "${label}"`);
      for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
        el.dispatchEvent(
          new window.MouseEvent(type, { bubbles: true, cancelable: true, button: 0 }),
        );
      }
      await new Promise((r) => setTimeout(r, 50));
    },
    async typeInto(selector, value) {
      const input = window.document.querySelector(selector);
      if (!input) return false;
      const proto =
        input.tagName === 'TEXTAREA'
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value);
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 100));
      return true;
    },
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
    errors,
    close: () => window.close(),
  };
  return api;
}

const drills = [
  {
    route: '/',
    async run() {},
  },
  {
    route: '/display',
    async run() {},
  },
  {
    route: '/admin',
    async run(page) {
      for (const key of 'STE_OFFICER_2026') {
        if (!page.has(key)) {
          await page.press(page.has('ABC') ? 'ABC' : '123');
        }
        await page.press(key);
      }
      await page.press('↵');
      await page.wait(700);
      if (!page.text().includes('OFFICER CONSOLE')) {
        page.errors.push('officer console did not unlock');
      }
    },
  },
  {
    route: '/student',
    async run(page) {
      await page.typeInto('input[aria-label="Your name"]', 'Juan Dela Cruz');
      if (page.has('Athena house, Robotics · AI · Computer Science')) {
        await page.press('Athena house, Robotics · AI · Computer Science');
      }
      await page.press('ENTER THE ARENA');
      await page.wait(900);
      if (!page.text().includes('Juan Dela Cruz')) {
        page.errors.push('student portal did not accept the name');
      }
      if (!page.text().includes('HOUSE TALLY')) {
        page.errors.push('house tally missing after entry');
      }
    },
  },
];

console.log(`\nSTE Quizball — dev DOM lint against ${ORIGIN}\n`);

let failures = 0;
for (const { route, run } of drills) {
  // eslint-disable-next-line no-await-in-loop
  const page = await boot(route);
  // eslint-disable-next-line no-await-in-loop
  try {
    // eslint-disable-next-line no-await-in-loop
    await run(page);
  } catch (err) {
    page.errors.push(String(err?.message ?? err));
  }

  const fatal = page.errors.filter((e) => !IGNORABLE.test(e));
  const painted = page.text().length > 200;
  if (fatal.length || !painted) failures += 1;

  console.log(
    fatal.length || !painted
      ? `  ✗ ${route}\n${fatal.map((e) => `      ${e.slice(0, 260)}`).join('\n')}`
      : `  ✓ ${route} — clean render, no DOM nesting errors`,
  );
  page.close();
}

console.log(
  `\n${failures === 0 ? '✓ dev bundle is clean' : `✗ ${failures} route(s) reported errors`}\n`,
);
process.exit(failures === 0 ? 0 : 1);
