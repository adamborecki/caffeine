# Project notes and handoff

This is the single place to pick the project back up, for a human or a coding agent. Read it top to bottom before changing anything.

## 1. What this is

A personal **caffeine and sleep planner** that Adam actually uses day to day on his phone. Anyone can also use it: they see Adam's routine as an example and press **Make it mine**.

- Live: https://adamborecki.github.io/caffeine/
- Repo: `adamborecki/caffeine`. Pushing to `main` deploys to GitHub Pages (`.github/workflows/static.yml` uploads the repo root).
- Owner workflow so far: push straight to `main`. No PRs, since this is a personal project.

## 2. Ground rules (decided; don't relitigate)

- **Static only:** `index.html`, `style.css`, `app.js`, with Chart.js 4.4.1 from cdnjs. **No framework and no build step** without asking Adam first.
- **Data stays in `localStorage`.** No accounts, no server, no analytics. Export and import JSON is the backup path.
- **Educational framing:** every claim in the UI cites a source in "How this works & sources". The disclaimer "Educational only, not medical advice" stays.
- **No "dopamine" claims.** Caffeine works mainly by blocking adenosine receptors.
- **Nutrition and medication:** link reputable sources and never give dosing advice.
- **Privacy of the owner:** the public example ("Adam's typical day") shows caffeine only. Keep any personal medication or supplement details out of defaults, docs, and commits. When stage 3 adds sleep aids, each user picks theirs from a generic list, and only the picks are saved locally.
- **Honesty over flattery:** show sample sizes and say plainly that early data is noise. Never imply causation.
- **Don't break Adam's saved data.** His phone holds real history. Any schema change must migrate inside `normalize()` (see §4), and `tests/e2e.mjs` must cover it.

## 3. Owner's setup (for sensible defaults)

- **Example routine** (`defaults()` in `app.js`):
  - On: Yogi Sweet Tangerine Positive Energy tea (70 mg) at 9:00, green tea with lemon & ginger (~30 mg) at 12:45, Moroccan mint green tea (~30 mg) at 4pm.
  - Off: Celsius small pour (3 oz ≈ 50 mg) at 2pm, preworkout (200 mg) at 3pm.
  - Also uses preworkout sticks (100 mg) and sometimes half a Celsius can (100 mg).
- **Body and sleep settings:**
  - Bedtime 12am, wake 7:50am.
  - Half-life **4 h**. He says he's sensitive, but 200 mg at 3pm feels fine, which suggests faster clearance.
  - "OK at bed" **60 mg**.
- Has an Apple Watch. Sleep data goes in manually for now (hours plus sleep score). Automating it was judged "too much fuss".
- Phone-first, so every change must work at a width of 360–390 px with touch.

## 4. Architecture

Everything lives in one `app.js` (about 450 lines) with section comments. Key pieces:

| Piece | What it does |
|---|---|
| `amt(mg, dt, ke)` | One-compartment curve. `KA = 3/h`, so the peak lands about 1 h after a dose. |
| `one(e, t, ke)` | One drink's contribution at hour `t` of its own day. |
| `carry(key, t, ke)` | Leftovers from the 2 previous days. Uses logged days; falls back to the same day's list when a day isn't logged. Off when `S.repeat` is false. |
| `dayTotal(key, t, ke)` / `total(t, ke)` | Sum for any day, or for the viewed day. |
| `cutoff(e, ke)` | Latest start time (15-minute steps, up to bed − 1.5 h) that keeps bedtime ≤ threshold, with the other drinks unchanged. |
| `normalize(o)` | **The only place saved or imported JSON becomes state.** It clamps everything and runs migrations. |
| `save()` | Mirrors `S.entries` into `S.days[S.active]` and writes localStorage. |
| `switchTo(key)` | Changes the viewed day. |
| `update()` | Recomputes labels, chart, metrics, and history, then saves. Called on every input. |
| `refresh()` | Full re-render: settings, list, library, check-in, then `update()`. |

Time is **hours from midnight** (8.25 = 8:15am). Bedtime can exceed 24 (24.5 = 12:30am). The chart's x-axis runs from 4 to 32 (4am to 8am the next day). **Days roll over at 4am** (`todayKey()`), so a 1am check still counts as "tonight".

### State (`localStorage['caffeine-planner-v2']`)

```js
{
  v: 2, rv: 2,               // schema version; rv = routine-migration version
  profile: 'example'|'mine', // example shows the "Adam's typical day" banner
  hl, thr, bed, wake,        // half-life h, OK-at-bed mg, bedtime h (20–27), wake h (5–12)
  repeat: true,              // count leftovers from earlier days
  custom: [{name, mg}],      // "My drinks" chips
  usual: [entry],            // template new days start from
  days: { 'YYYY-MM-DD': { entries: [entry], am?: {q, hrs, score, note}, pm?: {energy, mood, note} } },
  today, active,             // recomputed on load; the app always opens on today
  entries: [entry]           // = the viewed day's list (a copy of days[active].entries)
}
entry = { name, t, on, mg } or { name, t, on, perOz, oz }   // perOz is used for the Celsius pour
```

- `am` on date D means **the night before D** (a morning check-in about last night). `pm` on D is about day D.
- History pairs a day's bedtime caffeine with the **next** day's `am.q`.
- Today is always logged. A past day only gets a `days` entry once something changes on it (`save()` compares against `usual`).

### Migrations in `normalize()`
1. If `profile` is missing (pre-stage-1 data), the data is treated as the owner's: set to `mine`, and the old 25 mg default becomes 60.
2. If `rv < 2`: drinks still at the old example times (8:15, 12:30) move to 9:00 and 12:45, and the half-life changes 5 → 4 when that routine is detected.
3. If `usual`/`days` are missing (pre-stage-2 data), the single drink list becomes both today and the usual day.

To add one: bump `rv` (or add a field check), write the migration in `normalize()`, and add a case to the "Saved data from older versions" block in `tests/e2e.mjs`.

## 5. Testing

```sh
node tests/e2e.mjs [--shots]
```

- Runs Playwright on Chromium with a frozen clock: Fri Oct 16 2026, 5:30pm. Set `localStorage.__fakeNow` to move it.
- Covers: the example, the touch tooltip, steppers, the y-axis, legacy migrations, day navigation and backfill, check-ins, history and insight, day rollover, the usual day, export/import, Make it mine and Start over, and layout at 360, 390 dark, and 1024 px.
- If cdnjs is blocked (cloud sandboxes), it serves Chart.js from `$CHARTJS` or `tests/.cache/`, downloading it with `npm pack chart.js@4.4.1` if needed. In Claude Code cloud sessions, Playwright lives at `/opt/node-tools/node_modules/playwright`, and the test falls back to it.
- Always run it before pushing. Look at the `--shots` output (`tests/.out/`) for any visual change.

## 6. Science notes (sources are in the app)

- **Half-life** is roughly 2–10 h in adults, often about 5. Smoking shortens it. Pregnancy (up to about 15 h late in pregnancy), oral contraceptives (roughly doubles it), liver disease, and some drugs lengthen it.
- **Sensitivity** (receptor genetics, tolerance) is separate from **clearance** (CYP1A2). The UI keeps them as separate settings.
- **Drake et al. 2013:** 400 mg taken even 6 h before bed cut sleep by over 1 h, and people mostly didn't notice. The sample was 12 people.
- **Daily guidance:** the FDA says about 400 mg a day is generally fine for healthy adults. ACOG advises under 200 mg a day in pregnancy.
- **L-theanine:** may smooth how caffeine feels, but it doesn't change clearance, so it isn't modeled.
- **Product values:** Yogi Positive Energy Sweet Tangerine is about 70 mg per bag (label). Celsius is 200 mg per 12 oz. Some "Moroccan mint" teas are herbal (0 mg), so check the box.
- **For future exercise cards:** runner's high is more tied to endocannabinoids than to dopamine. Cold-plunge dopamine claims trace mostly to one small study, and cold immersion carries cardiac risk for some people.
- **Alcohol (for stage 3):** food slows absorption and lowers peak blood alcohol substantially, with a meal vs. an empty stomach often cited at about 30–50% lower. Meal size and fat/protein content matter more than "red meat" specifically. Elimination is roughly constant per hour (zero-order), about one US standard drink (14 g) per 1–2 hours, and it varies.

## 7. Roadmap

Done:
1. ~~v1 planner and Pages deploy~~
2. ~~Custom drinks, preset library, per-drink cutoff, Celsius pour slider~~
3. ~~Stage 1: mobile tooltip fix, sensitivity and half-life pickers, "Adam's day" with Make it mine~~
4. ~~Polish: fixed y-axis (200 mg, grows in 100 mg steps only if the total clips), ‹ › 15-minute steppers~~
5. ~~Stage 2: daily history by date, usual-day template, day navigator and backfill, logged leftovers, morning and evening check-ins, history list and first under-vs-over insight~~

Next, **stage 3: other things that affect sleep.** Agreed with Adam:
- **Log input:** tap, then time, then amount.
- **Alcohol:**
  - A drinks-in-system curve on the chart.
  - A food setting: empty / snack / meal / big rich meal.
  - Optional weight and sex, stored locally, to sharpen the estimate.
  - It must be clearly labeled as approximate, and must **never** be shown as BAC "fit to drive".
- **Sleep aids and other substances:**
  - A generic list: melatonin, trazodone, diphenhydramine (ZzzQuil/Benadryl), doxylamine (Unisom), magnesium, THC, CBD, plus custom entries.
  - The user picks theirs in settings. Only the picks are saved locally, and the public example shows none.
  - Logged only (time and amount). No curves, and no dosing advice.
- **History:** show the day's factors as small tags. Later, allow filtering the insight ("nights without alcohol").

Later, maybe:
- A multi-day chart (see yesterday's tail and today together).
- An exercise log (lifting, cardio, cold plunge) with educational cards.
- Fuller correlation views once there are weeks of data (sleep vs. bedtime caffeine, workout timing, alcohol), always showing n.
- Apple Watch import via the Health export or an iOS Shortcut. Adam said skip for now.
- A light "character sheet" (streaks), only if the tool stays useful.
- Sharing via URL parameters, with no accounts.

## 8. Known limitations and ideas not done

- Bedtime is a global setting, so history uses today's bedtime and half-life for every past day. Logging a per-night bedtime would make history more accurate.
- The "Under your level by" scan starts 1 h after the last drink, so a tiny late drink can report a time before that drink peaks. It's acceptable for now.
- The history list shows the latest 30 days. Older days stay in storage and in exports.
- Chart colors repeat after 8 drinks.
- The insight is a crude under/over split on the threshold. With more data, a scatter of sleep rating against bedtime mg would be better.
