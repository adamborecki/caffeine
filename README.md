# Caffeine & Sleep Planner

A small, private web app that shows how caffeine from each drink decays through the day, and how much is still in your body at bedtime.

**Live:** https://adamborecki.github.io/caffeine/

<img src="docs/screenshot.png" alt="Planner showing per-drink caffeine curves, the total, bedtime and wake markers" width="360">

## What it does

- Plots each drink's caffeine curve plus the total, with your sleep window shaded and a "now" marker.
- Shows caffeine **right now**, **at bedtime**, **when you drop under your comfort level**, and **left at wake-up**.
- For every drink, gives the **latest time you could have it** and still be under your level at bedtime.
- Opens on an example routine (Adam's typical day). **Make it mine** asks how hard caffeine hits you and how long it lasts, then starts you fresh.
- Keeps **sensitivity** (your "OK at bed" level) separate from **how long caffeine lasts** (half-life). They're different things.
- Has a preset library (tea, coffee, energy drinks, preworkout, and more). Every drink can be renamed, duplicated, or removed, and you can save your own custom drinks.
- Includes a "same routine every day" option that counts yesterday's leftovers.
- Lets you export and import your setup as JSON.

## The model, in plain English

Each drink is absorbed over about the first hour, then cleared at a steady rate set by your **half-life**. Most adults are around 5 hours, but it ranges from roughly 2 to 10 hours depending on genetics, smoking, pregnancy, oral contraceptives, liver function, and medications.

Technically, it's a one-compartment model with first-order absorption (ka = 3/h) and first-order elimination (ke = ln 2 / half-life):

```
C(t) = dose · ka / (ka − ke) · (e^(−ke·dt) − e^(−ka·dt)),   dt = t − doseTime
```

The mg shown is the amount left in the body, not a blood concentration.

## Limitations

- Your real half-life is unknown without testing. Adjust the slider until the results match how you sleep.
- The "OK at bed" level is a personal choice, not a clinical threshold.
- Drink caffeine values are typical servings. Brew strength and brands vary a lot, so check labels.
- It doesn't model tolerance, food, or other individual differences.

## Disclaimer

**Educational only, not medical advice.** If you're pregnant, take medication, or have a heart condition, talk to a clinician about caffeine. Sources are listed in the app under "How this works & sources".

## Privacy

There are no accounts, no server, and no analytics. Data stays in your browser's `localStorage`.

## Run it

Open `index.html` in a browser (`app.js` and `style.css` sit next to it). There's no build step. Chart.js loads from a CDN. Pushing to `main` deploys to GitHub Pages through `.github/workflows/static.yml`.

Project notes and the roadmap are in [`docs/NOTES.md`](docs/NOTES.md).

## License

[MIT](LICENSE)
