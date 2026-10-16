# Project notes

Working notes for anyone (human or coding agent) picking this project up.

## Goal

A small, useful personal tool for planning caffeine around sleep, and later exercise timing. It should be shippable, free to host, and usable by other people, so it must never assume a single user's body or routine.

## Ground rules

- One static `index.html` (HTML, CSS, JS) with Chart.js from a CDN. **No framework or build step** unless the owner agrees first.
- Data stays in `localStorage`, with JSON export and import. No accounts, server, or analytics.
- Educational framing only. Every factual claim in the UI cites a source, and the app says "Educational only, not medical advice".
- Call it an "energy and sleep planner". **No "dopamine" claims.** Caffeine acts mainly by blocking adenosine receptors.
- For nutrition and health topics, link reputable sources. Don't write individualized advice.

## Model

See the README. Key points:
- One-compartment model, ka = 3/h, ke = ln 2 / half-life. The output is mg in the body, not a blood concentration.
- "Under your level by" is the first time at least 1 h after the last dose when the total is at or below the threshold. It scans in 0.05 h steps.
- Each drink's cutoff is the latest start time, scanned in 15-minute steps up to 1.5 h before bed, that keeps the bedtime total at or below the threshold with all other enabled drinks unchanged.
- "Same routine every day" adds the same schedule shifted by −24 h and −48 h.

## Science notes for UI copy

- Half-life varies widely (roughly 2 to 10 h in adults). Smoking shortens it. Pregnancy, oral contraceptives, liver disease, and some drugs lengthen it.
- Drake et al. 2013: 400 mg taken even 6 h before bed cut sleep by over 1 h. The study was small (n = 12).
- FDA: about 400 mg a day is generally fine for healthy adults. ACOG: under 200 mg a day in pregnancy.
- For future exercise cards: runner's high is more associated with endocannabinoids than with dopamine. Claims that cold plunges raise dopamine trace mostly to one small study, and cold immersion carries real cardiac risk for some people.

## Roadmap

1. ~~Ship v1 and enable GitHub Pages.~~ Done.
2. ~~Custom drinks plus a preset library, with rename, duplicate, and delete.~~ Done, including a pour-size slider for Celsius and per-drink cutoff times.
3. "Right now" marker: done. Still to do: a multi-day view where you plan tomorrow separately from today.
3b. ~~Stage 1: mobile tooltip fix, sensitivity and half-life pickers, "Adam's day" example with a Make it mine flow.~~ Done.
4. Stage 2: daily history (each day saved by date, and tomorrow starts from your usual template). Optional reflections: morning (sleep 1–5, hours or Watch score, note) and evening (energy and mood 1–5, note).
5. Stage 3: factor log with tap, time and amount. Alcohol gets a drinks-in-system curve with a food setting (empty, snack, meal, big rich meal), plus optional weight and sex stored locally, clearly labeled as an approximation and never shown as fit to drive. Sleep aids come from a list of common ones (melatonin, trazodone, diphenhydramine, doxylamine, magnesium, THC, CBD…). The user picks their own and only the picks are saved locally. The public example never shows them.
6. Sleep log: bedtime, wake time, quality 1–5, and a note. Stored in `localStorage`, with export and import.
7. Correlation view: sleep quality vs. caffeine at bedtime and vs. workout timing. Show the sample size, say plainly that early data is mostly noise, and never imply causation.
8. Exercise log (lifting, cardio, cold plunge) with educational cards.
9. Optional: a light "character sheet" layer (streaks, stats), only once the tool is genuinely useful day to day.
10. Optional: sharing through URL parameters. No accounts.
