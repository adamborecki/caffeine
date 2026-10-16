// End-to-end checks for the planner in headless Chromium (Playwright).
//   node tests/e2e.mjs            run all checks
//   node tests/e2e.mjs --shots    also save screenshots to tests/.out/
//
// The app loads Chart.js from cdnjs. If that is blocked (e.g. a sandbox), the test serves a local copy:
// it uses $CHARTJS if set, else tests/.cache/chart.umd.js, else runs `npm pack chart.js@4.4.1` to get one.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const URL_ = pathToFileURL(join(ROOT, 'index.html')).href;
const SHOTS = process.argv.includes('--shots');
const OUT = join(HERE, '.out');

let pw;
try { pw = await import('playwright'); }
catch { pw = await import('/opt/node-tools/node_modules/playwright/index.mjs'); }

function chartJs() {
  if (process.env.CHARTJS) return process.env.CHARTJS;
  const cache = join(HERE, '.cache'), file = join(cache, 'package/dist/chart.umd.js');
  if (!existsSync(file)) {
    mkdirSync(cache, { recursive: true });
    execSync('npm pack chart.js@4.4.1 --silent && tar xzf chart.js-4.4.1.tgz', { cwd: cache, stdio: 'ignore' });
  }
  return file;
}
const CHART = chartJs();

// Freeze the clock. localStorage "__fakeNow" (ms) can move it, then reload.
const BASE_NOW = new Date(2026, 9, 16, 17, 30).getTime(); // Fri Oct 16 2026, 5:30pm local
function fakeClock(base) {
  const Real = Date;
  const now = () => +(localStorage.getItem('__fakeNow') || base);
  globalThis.Date = class extends Real {
    constructor(...a) { super(...(a.length ? a : [now()])); }
    static now() { return now(); }
  };
}

let failures = 0, passes = 0;
function check(name, cond, extra = '') {
  if (cond) { passes++; console.log('  ✓ ' + name); }
  else { failures++; console.log('  ✗ ' + name + (extra ? '  → ' + JSON.stringify(extra) : '')); }
}

const browser = await pw.chromium.launch();
async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, ...opts });
  await ctx.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ path: CHART, contentType: 'application/javascript' }));
  await ctx.addInitScript(fakeClock, BASE_NOW);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('console', m => m.type() === 'error' && page.errors.push(m.text()));
  page.on('dialog', d => d.accept());
  await page.goto(URL_);
  return page;
}
const state = p => p.evaluate(() => ({
  profile: S.profile, hl: S.hl, thr: S.thr, today: S.today, active: S.active,
  entries: S.entries.map(e => ({ name: e.name, t: e.t, on: e.on, mg: e.perOz ? Math.round(e.perOz * e.oz) : e.mg })),
  usual: S.usual.length, days: Object.keys(S.days).sort(), ymax: chart.options.scales.y.max,
  bed: mBed.textContent, now: mNow.textContent, banner: !banner.hidden, label: dayLabel.textContent,
  datasets: chart.data.datasets.map(d => d.label),
}));
const saved = p => p.evaluate(() => JSON.parse(localStorage.getItem('caffeine-planner-v2')));
const rowOf = (p, prefix) => p.locator('.row[data-id]', { has: p.locator(`input.name[value^="${prefix}"]`) });
const shot = async (p, name, full = false) => { if (SHOTS) { mkdirSync(OUT, { recursive: true }); await p.screenshot({ path: join(OUT, name + '.png'), fullPage: full }); } };

// ---------------------------------------------------------------------------
console.log('First visit (example)');
{
  const p = await newPage();
  const s = await state(p);
  check('example profile with banner', s.profile === 'example' && s.banner, s);
  check("Adam's routine: tangerine 9am, green tea 12:45, half-life 4h, 60 mg", s.entries[0].t === 9 && s.entries[1].t === 12.75 && s.hl === 4 && s.thr === 60, s);
  check('y-axis fixed at 200', s.ymax === 200, s.ymax);
  check('today is logged', s.days.length === 1 && s.days[0] === s.today, s.days);
  check('earlier-days curve shown', s.datasets.includes('Earlier days'), s.datasets);
  await shot(p, 'top');
  await shot(p, 'full', true);

  const box = await p.locator('#c').boundingBox();
  await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await p.waitForTimeout(200);
  const tipOn = await p.evaluate(() => chart.tooltip.getActiveElements().length);
  await p.waitForTimeout(1800);
  const tipOff = await p.evaluate(() => chart.tooltip.getActiveElements().length);
  check('touch tooltip shows, then hides', tipOn > 0 && tipOff === 0, { tipOn, tipOff });

  const yogi = p.locator('.row[data-id]').first();
  await yogi.locator('.step[data-d="15"]').tap();
  check('› moves a drink 15 minutes', (await yogi.locator('.tv').textContent()) === '9:15am');
  await p.locator('#bedv ~ .step').tap();
  check('› moves bedtime 15 minutes', (await p.locator('#bedv').textContent()) === '12:15am');

  await rowOf(p, 'Preworkout').locator('input.on').check();
  await rowOf(p, 'Celsius').locator('input.on').check();
  check('y-axis grows only when the total would clip', (await state(p)).ymax === 300);
  check('no console errors', p.errors.length === 0, p.errors);
  await p.context().close();
}

// ---------------------------------------------------------------------------
console.log('Saved data from older versions');
{
  const p = await newPage();
  await p.evaluate(() => localStorage.setItem('caffeine-planner-v2', JSON.stringify({
    v: 2, hl: 5, bed: 24, wake: 7.8333, thr: 25, repeat: true, custom: [{ name: 'My soda', mg: 45 }],
    entries: [
      { name: 'Yogi Sweet Tangerine Positive Energy tea', mg: 70, t: 8.25, on: true },
      { name: 'Green tea, lemon & ginger', mg: 30, t: 12.5, on: true },
      { name: 'Preworkout (1 scoop)', mg: 200, t: 15, on: false },
    ],
  })));
  await p.reload();
  const s = await state(p);
  check('pre-profile data becomes "mine", 25 mg → 60', s.profile === 'mine' && s.thr === 60 && !s.banner, s);
  check('old example times move to 9:00 / 12:45, half-life 5 → 4', s.entries[0].t === 9 && s.entries[1].t === 12.75 && s.hl === 4, s.entries);
  check('drink list becomes today and the usual day', s.entries.length === 3 && s.usual === 3 && s.days.join() === s.today, s);
  const d = await saved(p);
  check('custom drinks kept', d.custom.length === 1 && d.custom[0].name === 'My soda', d.custom);
  await p.context().close();
}

// ---------------------------------------------------------------------------
console.log('Days, history, and check-ins');
{
  const p = await newPage();
  const before = await state(p);

  await p.click('#dayPrev');
  let s = await state(p);
  check('‹ goes to yesterday', s.label === 'Yesterday' && s.active === '2026-10-15', s);
  check('past day starts from usual day and is not logged until edited', s.days.length === 1 && s.now === '–', s);
  check('no "Now" while viewing a past day', s.now === '–');

  await rowOf(p, 'Preworkout').locator('input.on').check();
  s = await state(p);
  check('editing a past day logs it', s.days.includes('2026-10-15'), s.days);

  await p.click('#backToday');
  s = await state(p);
  check('back to today keeps today unchanged', s.active === s.today && JSON.stringify(s.entries) === JSON.stringify(before.entries), s.entries);
  check("yesterday's logged preworkout raises today's bedtime leftovers", parseInt(s.bed) > parseInt(before.bed), { before: before.bed, after: s.bed });

  // Morning check-in on today = how the night after yesterday went.
  await p.locator('.rate[data-f="am.q"] button[data-n="4"]').tap();
  await p.fill('[data-f="am.hrs"]', '7.25');
  await p.fill('[data-f="am.note"]', 'woke once');
  await p.locator('.rate[data-f="pm.energy"] button[data-n="3"]').tap();
  await p.locator('.rate[data-f="pm.mood"] button[data-n="5"]').tap();
  await p.locator('.rate[data-f="pm.mood"] button[data-n="5"]').tap(); // tap again clears
  let d = await saved(p);
  check('check-in saved', d.days[s.today].am.q === 4 && d.days[s.today].am.hrs === 7.25 && d.days[s.today].am.note === 'woke once' && d.days[s.today].pm.energy === 3, d.days[s.today]);
  check('tapping a rating again clears it', d.days[s.today].pm.mood === undefined, d.days[s.today].pm);

  await p.click('#histBox summary');
  const rows = await p.locator('#histList .hrow').count();
  const insight = await p.locator('#insight').textContent();
  check('history lists both days', rows === 2, rows);
  check('insight pairs yesterday with this morning and flags the small sample', /n=1/.test(insight) && /mostly noise/.test(insight), insight);
  await shot(p, 'checkin-history', true);

  await p.reload();
  s = await state(p);
  check('reload opens on today', s.active === s.today, s);
  check('check-in values reload', (await p.inputValue('[data-f="am.hrs"]')) === '7.25');

  // Clock moves to tomorrow morning: today becomes a new day from the usual template.
  await p.evaluate(() => localStorage.setItem('__fakeNow', String(new Date(2026, 9, 17, 9, 0).getTime())));
  await p.reload();
  s = await state(p);
  check('new day after 4am uses the usual day', s.today === '2026-10-17' && s.days.includes('2026-10-16') && s.entries.length === 5, s);
  check('new day has an empty check-in', (await p.inputValue('[data-f="am.hrs"]')) === '');

  // Set usual day from today.
  await rowOf(p, 'Moroccan').locator('.del').click();
  await p.click('#saveUsual');
  check('"Set as my usual day" saves the template', (await saved(p)).usual.length === 4);

  // Export → import round trip.
  const json = await p.evaluate(() => localStorage.getItem('caffeine-planner-v2'));
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'export.json'), json);
  await p.click('details:has(#importBtn) summary');
  await p.setInputFiles('#importFile', join(OUT, 'export.json'));
  await p.waitForTimeout(200);
  d = await saved(p);
  check('import restores history and check-ins', Object.keys(d.days).length === 3 && d.days['2026-10-16'].am.q === 4, Object.keys(d.days));
  check('no console errors', p.errors.length === 0, p.errors);
  await p.context().close();
}

// ---------------------------------------------------------------------------
console.log('Make it mine / start over');
{
  const p = await newPage();
  await p.click('#mineBtn');
  await p.check('input[name=sens][value=low]');
  await p.check('input[name=hl][value=fast]');
  await p.fill('input[name=bed]', '00:30');
  await p.check('input[name=start][value=copy]');
  await shot(p, 'dialog');
  await p.click('.dlgBtns button[value=ok]');
  await p.waitForTimeout(200);
  let s = await state(p);
  check('copy start: mine, 100 mg, 3.5h, 12:30am bed, 5 drinks', s.profile === 'mine' && s.thr === 100 && s.hl === 3.5 && s.entries.length === 5 && !s.banner, s);
  await p.click('details:has(#resetBtn) summary');
  await p.click('#resetBtn');
  s = await state(p);
  check('start over returns to the example', s.profile === 'example' && s.banner && s.days.length === 1, s);
  await p.click('#mineBtn');
  await p.click('.dlgBtns button[value=ok]');
  await p.waitForTimeout(200);
  s = await state(p);
  check('empty start: no drinks, medium 50 mg, 5h', s.entries.length === 0 && s.thr === 50 && s.hl === 5, s);
  check('no console errors', p.errors.length === 0, p.errors);
  await p.context().close();
}

// ---------------------------------------------------------------------------
console.log('Layout');
for (const [w, scheme] of [[360, 'light'], [390, 'dark'], [1024, 'light']]) {
  const p = await newPage({ viewport: { width: w, height: 800 }, colorScheme: scheme, ...(w > 800 ? { isMobile: false, hasTouch: false } : {}) });
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  check(`no sideways scroll at ${w}px ${scheme}`, sw <= w, sw);
  await shot(p, `layout-${w}-${scheme}`, true);
  await p.context().close();
}

await browser.close();
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
