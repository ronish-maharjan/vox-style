# Architecture

How the pieces fit. Read this once and the repo stops feeling like 40 tools.

```
                          you (or an AI) write ONE of these
                     intent.json ──────────► script.json
                          (recipes)    compile    (full detail)
                              │                        │
                              ▼                        ▼
   ┌────────────────────── tools/ (CLI, one job each) ─┼──────────────────────┐
   │  validate ─── the authority: type grammar, cues, pacing, collisions     │
   │  video ────── the whole pipeline as ONE command (stage status JSON)     │
   │  speak/align─ audio: Piper TTS → Whisper word timings → words.json      │
   │  sfx/mix ──── synthesized sound design + narration/music mixdown        │
   │  capture ──── parallel frame render → ffmpeg → MP4 (segmented)          │
   │  qa/analyze ─ human sheets + machine-readable flags/suggestions         │
   │  subtitles/thumbnail/watch/mcp …                                       │
   └──────────────┬─────────────────────────────────────────────┬────────────┘
                  │ builds on                                   │ drives
                  ▼                                             ▼
   ┌─ lib/ (shared) ─┐   ┌─ core/ (engine, DOM-free) ─┐   ┌─ backends/ ─┐
   │ registry (prop  │   │ director: script+words →   │   │ node.js     │
   │  discovery),    │   │  timeline (cues, spans)    │   │  (skia or   │
   │ fonts list      │   │ renderer: paper → world    │   │  napi canvas│
   └─────────────────┘   │  layers → screen layers →  │   │  + images + │
                         │  grain → transitions →     │   │  raw pixels)│
   core/constants.js ◄───│  captions                 │   │ browser.js  │
   (ONE source: formats, │ camera: moves + parallax   │   └─────────────┘
   safe areas, moves,    │ props/*: pure (o, env)     │
   sfx, layer keys)      │  draw functions + meta     │
                         └────────────────────────────┘
```

## Layering (enforced by convention, tested by imports.test)

`lib/` → `core/` → `backends/` → `tools/`. Each layer may import only from layers
above it in that list (tools may import anything). `core/` and `props/` never touch
the DOM, `node:` modules, or each other's internals — a prop is a pure function of
`(o, env)` and talks to the engine only through `vox-studio/core/*` and
`vox-studio/kit/*` (the `_shared` helpers).

## The data path

1. **intent.json → script.json** (`compile`): recipes expand into fully-styled shots.
   Cue words are auto-picked (distinctive content words, position-bounded), multi-shot
   lines get automatic spans. A weak model writes 20 lines of intent; the compiler
   emits 300 lines that validate first try.
2. **script.json + words.json → timeline** (`core/director.js`): lines get real word
   timings (Whisper) or estimates; cues (`word:flag#2+0.2s`), spans, layers, camera,
   sfx and transitions all resolve to concrete times. Anything unresolvable throws
   with a message that names the fix.
3. **timeline → pixels** (`core/renderer.js`): per frame — paper base, world layers
   (camera + depth parallax), screen layers, film grain, transitions, captions.
   A bounds registry pre-pass records every layer's box so annotations can lock onto
   targets (`"target": "<id>"`); placed layers (`place:`) register boxes too.
   A prop that throws draws a red error bar instead of killing the render.
4. **pixels → MP4** (`capture`): N worker processes render frame ranges in parallel
   into segment files, ffmpeg concatenates and muxes audio. Draft mode renders at
   15fps for speed; final at 30.

## The "any AI" surface

| Surface | What it is |
|---|---|
| `CATALOG.md` | generated from prop `meta` — the only doc a script AI needs |
| `intent.json` + `compile` | intent-level authoring (recipes, auto-cues) |
| `place:` / `target:` | layout without pixel math |
| `validate --json` | machine-readable verdict with fix suggestions |
| `npm run video` | one command, stage status JSON, never blocks on a human |
| `qa --json` / `analyze` | flags (LONG/EMPTY/COLLISION) + suggested fixes |
| `npm run mcp` | MCP server: 8 tools (catalog/slots/validate/compile/video/qa/frame/speak) |
| `index.js` | `renderProject()` for embedding |

## Where things live

- `core/constants.js` — formats, safe areas, camera moves, sfx types, layer keys (single source)
- `core/theme.js` — all colors/fonts/weights (register a theme here, never hard-code)
- `props/<category>/<name>/` — one prop per folder, `index.js` with `{ meta, draw }`
- `recipes/*.json` — intent-level shot templates (name/use/params/shot)
- `projects/<name>/` — intent.json, script.json, audio/, assets/, build/, qa/, out*.mp4
- `mcp/server.mjs` — the tool-calling surface
- `bin/vox.mjs` — `vox <command>` hub (every tool, grouped and documented)
