# STYLE

## Look
- Warm paper, one ink color, two accents (tomato, cobalt), one highlight (marker yellow). Defined ONLY in core/theme.js.
- Fonts: Anton (display) + Inter (text). Special Elite / Libre Baskerville only inside document props.
- Motion: ease-out entrances 150-400 ms; overshoot only on stamps/pins; the camera always moves slowly.
- Pace: a new visual or cue every 2-3 s; at most 2 text-heavy props on screen.
- Handmade: wobble in marks, torn edges seeded per prop, soft shadows, grain overlay.

## Engineering rules
- core/ and props never touch the DOM (no document/window/new Image). Draw through ctx only.
- Props are pure: output depends on (o, env). Use env.rng(label), never Math.random/Date.now.
- Sprite caches live on env.sprites and are keyed by everything that affects the pixels.
- Backgrounds should be drawn at depth <= 0.3 and with bleed so camera moves never expose edges.

## QA pitfalls (append every issue found)
- Transition SFX used to fire on the wrong shot: audio events must derive from the director's `tl.transitions[]`, never from the raw script (C1, tests/fixes.test.mjs).
- `script.meta.aspect` was silently defeated by CLI defaults; resolution order everywhere is `--aspect` flag > `meta.aspect` > `9:16` (C2).
- Fixtures drift: any prop name mentioned in a project script, CATALOG.md or prop meta must exist — the catalog self-consistency test extracts every camelCase token and checks it (C3).
- A bare string in `shot.sfx` used to pass validate and crash the director; sfx is fully schema-validated now (M5).
- Capture's `.build/` output dir must be skipped by make's cache walker, or the render cache busts every run (M4).

## Lessons (Phases 1–5)

**Determinism**
- A prop is a pure function of `(o, env)`. No `Math.random`, `Date.now`, DOM, or module-level mutable state. Use `env.rng(label)`.
- Anything cached via `sprite()`/`cached()` must put EVERY input in the key. A missing input shows up as "frame looks different depending on render order" — `tests/determinism.test.mjs` catches it.
- Props can't see layer age. Anything that animates after frame one is driven by `o.appear` (0..1) and `meta.enter` (seconds).

**Imports and paths**
- Props import the studio only via `vox-studio/core/...` and `vox-studio/kit/...`. Never `../` out of a prop folder.
- Assets are referenced by name (`"signing-1984.jpg"`) and resolved by the loader (`core/project.js` via `backends/node.js`): project dir first, then project `assets/`, then repo root, then repo `assets/`. Absolute paths are honoured; case must match exactly. The `projects/<p>/assets` manifest maps short keys to these paths.
- A missing asset gives a placeholder, never a crash. A missing `word:` cue throws, because a wrong sync is worse than a stopped render.

**Look**
- Paper, one ink, two accents (tomato, cobalt), one highlight (yellow). Every colour, font, line weight and shadow comes from `theme.js`.
- Entrances 150–400 ms ease-out. Overshoot only on stamps and pins. The camera always moves slowly.
- Max two text-heavy props at once; a new visual or cue every 2–3 s; keep everything inside the safe area (captions own the bottom).
- Highlights and circles are positioned relative to another prop; always check them in the QA shot frames (`shot-NNb`), not just the contact sheet.

**Narration text**
- Write numbers as digits; the aligner expands "1997" ↔ "nineteen ninety-seven". Use `say` only when the spoken form differs (names, acronyms).
- Cue on words that are clearly spoken and unique in the line (`word:agreed`), not "the". If a name is hard for Whisper, cue on the word next to it.
- 8–12 words per line keeps shots at 2–4 s.

**Pipeline**
- Never trust a render you haven't looked at: `npm run qa -- <project>` after every change that touches visuals.
- `align` is a gate: fix the script wording or re-record rather than `--allow-low`.
- Big/derived files (models, venv, build/, renders) never go into git; `npm run pack` ships them.
