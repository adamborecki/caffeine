# CLAUDE.md

Personal caffeine and sleep planner. It's a static site on GitHub Pages and the owner uses it daily on his phone.

**Read `docs/NOTES.md` first.** It's the full handoff: decisions, architecture, data model, migrations, roadmap.

## Rules
- Plain HTML, CSS, and JS (`index.html`, `style.css`, `app.js`), with Chart.js from cdnjs. Ask before adding a framework, a build step, or dependencies.
- Data lives in localStorage only. No backend, accounts, or analytics.
- Never break saved data. Every schema change goes through `normalize()` in `app.js` with a migration, plus a test in `tests/e2e.mjs`.
- Keep the owner's private info out of the repo: no personal sleep-aid or medication details in defaults, docs, or commits. The public example shows caffeine only.
- UI copy is educational: cite sources, keep "Educational only, not medical advice", make no dopamine claims, and give no dosing advice. Show sample sizes and never imply causation.
- Mobile first: test at 360–390 px with touch, in both light and dark. Tap targets should be at least 34 px.
- Match the existing code style: compact JS, `$()` for getElementById, CSS tokens on `:root` with dark overrides.

## Workflow
- Run `node tests/e2e.mjs --shots` before every push and look at `tests/.out/*.png` for visual changes. All checks must pass.
- The owner pushes straight to `main`, which deploys to Pages. Commit messages should say what changed and why.
- Update `docs/NOTES.md` (roadmap, data model) and `README.md` (features) when behavior changes.
