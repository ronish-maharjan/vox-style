# vox-studio Deep Analysis & Improvement Plan

**Repo saved at:** `/home/z/my-project/repo-backup/vox-style-extracted/vox-style`
**Git state:** committed on `main`, tagged `v0-original` (the uploaded zip is untouched; every improvement will be a new commit, and we can always diff/rollback against the tag)
**Analysis date:** 2026-11-16 · 157 files, ~6,400 lines of code

---

## 1. What this repo is (verified, not assumed)

A deterministic, code-drawn "paper-craft explainer" video studio: you write ONE JSON file (`projects/<name>/script.json`), and the system renders an MP4 with voiceover, word-synced captions, camera moves, transitions and synthesized sound effects. No AI imagery — all graphics are Canvas 2D "props" drawn in code (29 props across 12 categories), photos are user-supplied.

**Pipeline (verified end-to-end in this sandbox):**
`script.json` → `validate` → `export` (narration.txt) → audio (human or Piper TTS) → `align` (Whisper word timings) → `make --draft` → `qa` (contact sheets) → `make` (final MP4)

**Health check I ran:**
- `npm install` + `npm test` → **147/147 tests pass** (was 85 pass / 1 fail / 61 skipped before install — expected, skia-canvas missing)
- `npm run doctor` → all required checks green (whisper model optional, missing)
- `npm run validate -- demo` → valid (2 pacing warnings)
- `npm run make -- demo --draft` → **renders in 2.0s at 52 fps**, 107 frames
- `node --version` 24, ffmpeg-static works, skia-canvas raw-pixel path self-calibrates

---

## 2. Honest verdict on "is it messy?"

**No — it is unusually well-engineered for its size.** Things that are *better* than most comparable open-source video projects (keep these, don't break them):

| Strength | Evidence |
|---|---|
| **Determinism by design** | Props are pure functions of `(o, env)`; seeded RNG everywhere; `tests/determinism.test.mjs` proves frames are repeatable and order-independent. This is the #1 thing production video pipelines get wrong, and this repo gets it right. |
| **The Catalog pattern** | `CATALOG.md` is auto-generated from each prop's `meta` (use/avoid/slots/options/example). One doc, one truth, AI never invents props. This is genuinely ahead of Remotion-style projects. |
| **Validation-first** | `npm run validate` is declared "the authority" and it's real: type grammar (`core/protocol.js`), cue resolution, pacing rules, asset checks, Levenshtein "did you mean" suggestions. |
| **Error containment** | A prop that throws draws a red error bar on that frame instead of crashing the render (`core/renderer.js` callProp). |
| **Word-level sync with a real cue grammar** | `word:flag#2+0.2s`, spoken/display token mapping (`core/words.js` mapTokens handles "1997" ↔ "nineteen ninety-seven"). |
| **Graceful degradation everywhere** | Missing photo → placeholder, never a crash; missing words.json → estimated timings with a warning; no audio → silent video. |
| **A serious review was already done** | `CHANGES.md` documents 3 critical + 6 major fixes (C1–C3, M1–M6), all with tests. |

The mess is real but **concentrated in specific places**, not pervasive. Here is every issue I found, then the plan.

---

## 3. Concrete problems found (the actual "mess")

### 3.1 Architecture violations
1. **`core/` depends on `tools/`** — `backends/node.js:7-8` imports `ROOT, discoverProps` from `tools/lib/registry.mjs` and `FONTS` from `tools/lib/fonts.mjs`. The STYLE.md rule says core must stay DOM-free and tools are supposed to sit on top of core. The dependency is inverted: core is un-importable without the tools layer.
2. **`package.json` `"main": "index.js"` but no `index.js` exists.** There is no public programmatic entry point at all.
3. **Constants duplicated in 3+ places, drifting already:**
   - `FORMATS` / safe areas: `core/theme.js`, `tools/validate.mjs` (admits "kept literal so validate has no theme dependency"), `tools/qa.mjs` ("keep in sync with core/theme.js" comment)
   - `CAMERA_MOVES`: `core/camera.js`, `tools/validate.mjs`
   - `SFX_TYPES`: `tools/validate.mjs`, catalog header
   - **Fix:** one `core/constants.js` (or schema) that everything imports; validate already needs no theme, it just needs the constants.
4. **Three tape implementations**: `core/helpers.js tape()`, `props/_shared/look.js drawTape()`, `props/_shared/paper.js tapeStrip()`. Same for two font-stack systems (`theme.fonts` + `look.js FONT_DEFAULT` fallbacks).
5. **Dead defensive code** in `backends/node.js`: `duration()` probes `tl.duration/total/end/length` (only one timeline shape exists); `makeFrameRenderer` probes render call signatures with try/catch TypeError (core's signature is stable now).
6. `core/helpers.js:33` has a commented-out old line left in; `find()` in `backends/node.js:73-86` has broken indentation; asset search order in code (project → root → project/assets) doesn't match the documented order in STYLE.md/CATALOG.md.

### 3.2 Documentation drift
7. **`docs/CHAT-MODE.md:27` tells users to run `npm run brief:prop` — that script does not exist in package.json** (only `brief`; `brief-prop.mjs` exists but is unwired). A new user following the doc hits an error immediately.
8. `STYLE.md` "QA pitfalls (none yet)" — permanent placeholder.
9. No `LICENSE` file at all — the repo bundles 4 fonts (Anton, Inter, Special Elite, Libre Baskerville — all OFL) and 660KB of Natural Earth-derived geo data (public domain); redistribution without attribution is legally sloppy for a "production" repo.
10. README explains commands but not architecture; there is no diagram of the pipeline anywhere except a one-line comment in `renderer.js`.

### 3.3 Tool sprawl (the "messy" feeling)
11. **31 npm scripts / 30+ tool files**, several overlapping: `make` vs `capture` vs `render-range` vs `mix` vs `sfx` (all pipeline stages, separately runnable); `validate` vs `schema` vs `slots`; `brief` vs `brief-prop`; `setup` vs `setup-audio` vs `setup-geo` vs `bundle` vs `pack`; `catalog` vs `scan-props` vs `fix-imports` vs `audit-roots` vs `geo-names` vs `new-prop`. Individually each is fine and documented; collectively it's a wall of commands with no `--help` hub, no subcommand grouping, no "which one do I run next" guidance.
12. No CI (no GitHub Actions), no linter/formatter config, no coverage — the 147 tests only run if someone remembers.

### 3.4 The "any AI can use this" gaps (your main goal)
This is the most important section. The current design assumes a *strong agentic AI* that can: read a 1,200-line CATALOG.md, hand-place pixel coordinates, run 8 commands in the right order, and *look at* PNG contact sheets. Every one of those assumptions is exactly where weaker models fail:

13. **Pixel placement is the #1 failure mode for weak AIs.** Every layer wants `x/y/w/h` (or `%`). The repo already invented the fix — the `target: "<layer id>"` bounds-registry lock in `core/renderer.js` (annotations inherit a target's box) — but it's opt-in, only 3-4 props mention it, and there is **no auto-layout**: no stacking, no grid, no collision avoidance, no "safe placement" pass. Weak AIs produce overlapping props and off-center content constantly. The bounds registry (`renderer.bounds()`) already computes every layer's box — collision detection is nearly free and nobody uses it.
14. **No one-command pipeline.** The AI must know and sequence: catalog → write → validate → export → audio → align → draft → qa → final. `make` covers the last steps but requires audio to exist. There is no `npm run video -- <name>` that runs the whole loop with sensible defaults (TTS when no audio, estimated timings when no whisper, draft-first).
15. **TTS is a "spike", not a default.** `tools/speak.mjs` (Piper) exists but: no bundled voice, exit code 2 if not installed, and the skill tells the AI "Do not generate audio. The human makes it." — so every "AI-generated video" demo stops dead at a human step. The fully-automated path is what makes any-AI generation viable (this is exactly how short-video-maker et al. work).
16. **Feedback loops are human-oriented, not machine-readable.** `qa` writes `report.txt` + PNGs for *eyes*. There's no `qa --json` with machine-readable flags (LONG/EMPTY shots, collisions, safe-area violations), no suggested fixes, and no automatic overlap/overflow detection — the QA step is literally "LOOK at them".
17. **Recipes are copy-paste, not compiled.** `recipes/*.json` (stat-reveal, chart-card, place-pin, verdict-stamp, clip-mark) are exactly the right idea — intent-level shot blocks — but an AI must hand-merge them into a script with `{{param}}` substitution by hand. A `vox compile` (recipes + params → script.json) would let a weak model emit `{"recipe":"stat-reveal","value":"156","label":"years of British rule"}` and get a *perfectly styled* shot every time. This is the single highest-leverage "weak AI = strong AI" feature.
18. **Chat mode is paste-ball.** BRIEF.md → new chat → paste → save → paste errors back. No MCP server, no HTTP API, no tool-calling surface. Remotion ships agent-oriented docs and MCP integrations for exactly this reason.
19. **English-only pipeline.** Whisper `small.en` in `align.config.json`, English-centric syllable estimation in `core/words.js`, Latin-focused `norm()` (Unicode OK but cue-matching and caption chunking are English-tuned). Fine as v1 scope, but it should be stated, and `align` should accept other Whisper models.

### 3.5 Production-readiness gaps
20. **No SRT/subtitle export** — words.json already contains every word timing; an SRT/ASS exporter is ~50 lines and unlocks YouTube/SEO/accessibility.
21. **No thumbnail/cover command** — QA frames are the closest thing; a `thumbnail` tool (pick a time, add title-safe crop) is a standard short-video need.
22. **No `titleCard` prop** — there is no opening-title prop in the whole catalog (you'd abuse `paperScrap`). Nearly every explainer needs one; it would become a top-3 used prop.
23. Only 9:16 and 16:9. 1:1 and 4:5 (socials) are trivial additions to `FORMATS` — but note `backends/node.js SIZES` and `qa.mjs` hard-code the two too (see #3).
24. No watch mode (edit script.json → draft re-renders); preview server exists but is static.
25. No shot-level render cache — `make` caches whole steps (`make.state.json`), but changing one shot re-renders the whole video. A per-segment cache (shot def hash → segment mp4) would make iteration ~10x faster on long videos. Capture already renders in segments and concatenates, so the structure is already there.

---

## 4. Reference: what comparable production projects do

| Project | What they do better | What vox-studio does better | What to copy |
|---|---|---|---|
| **Remotion** (remotion.dev, commercial, the category leader) | Cloud rendering (Lambda), parametrized templates, Studio (live preview IDE with timeline), 1,200 pages of docs, agent/AI-oriented docs + MCP tooling, bulk render | Determinism guarantees, prop catalog as single source of truth, paper-craft aesthetic, zero-build JSON-only authoring (Remotion requires writing React code — much harder for weak AIs) | Parametrized recipes (→ templates), a better preview (timeline scrub + edit-reload), MCP server for tool-calling agents, cloud/bulk render story |
| **Manim + Generative-Manim / Manimator** (LLM writes Manim code) | Mature render engine, huge community | **vox-studio's JSON-first authoring is the correct answer to why "GPT writes Manim" fails** — LLM code-gen is error-prone; declarative + validated JSON beats free code. Keep this. | Nothing on authoring; consider their config-file pattern (`manim.cfg`) for align.config/defaults |
| **MoviePy / video-as-code** | Imperative flexibility | Deterministic, data-driven scenes; reproducible builds | "Video as code" framing: content-hash the script → build dir per version (partially exists via make.state.json) |
| **short-video-maker** (gyoridavid) & the shorts-generator family | **Fully automated end-to-end**: LLM script → TTS → stock/backgrounds → auto-captions → final MP4, zero human steps | Visual quality/craft (paper-craft look vs generic stock), sound design, camera language, word-cue choreography | The **default-on automated path**: TTS bundled, timings estimated when no align, one command to MP4. This is what "any AI generates a video" means in practice |
| **OpenAI structured outputs / guardrails patterns** | Schema-constrained generation | `tools/schema.mjs` already generates a JSON Schema (rare and good!) | Publish the schema as THE contract for generation: schema + few-shot examples per prop; add a "compile from intent" layer |

---

## 5. The improvement plan (prioritized)

### Phase P0 — "Any AI, any video" (your main goal)

**P0.1 Recipe compiler + intent-level authoring.**
`vox compile intent.json → script.json`. Intent format: lines + per-line `{recipe, params}` + optional raw layers. Recipes get parameter validation, cue-word auto-pick (choose a distinctive word from the line automatically — the repo already has the word-frequency logic in validate to detect non-distinctive words). Weak model outputs 30 lines of simple intent JSON; the compiler emits a 300-line script.json that validates first try.
*Why first: biggest quality-per-token gain; makes weak models produce high-end output deterministically.*

**P0.2 Auto-layout & collision detection (the pixel-placement killer).**
- Expose the bounds registry after the pre-pass: detect overlapping content props and out-of-safe-area boxes; report in validate (`--json`) and QA with suggested nudges ("move layer 2 to y 62% or add target: s1l2").
- Add placement sugar to the director: `place: "center" | "top" | "stack:1" | "grid"` resolved at build time, and extend `target:` locking to every annotation prop (some already have it — make it universal and documented in the catalog).
- Auto-annotate: `arrow`/`callout`/`highlighter` with `target` + `pad` should be *the documented default*, pixel x/y the advanced override.

**P0.3 One command to MP4: `npm run video -- <name> [--topic "..."]`.**
Orchestrates: compile/generate script → validate loop (max N auto-fix attempts) → audio (existing files > Piper > estimated timings + warning) → align (if whisper available) → draft → QA heuristics (no human) → final. Every stage machine-readable, resumable, with a single status JSON the AI can read. Never blocks on a human by default; `--strict-audio` opts back into the current behavior.

**P0.4 TTS as a first-class default.**
Bundle one Piper voice (or auto-download on setup), wire `speak` into `video`, add 2-3 voice presets + per-line `say` respect. Target: `npm run video` on a fresh clone produces a narrated MP4 with zero human input.

**P0.5 Machine-readable feedback everywhere.**
`validate --json` (exists) + `qa --json` (new): shot table, flags (LONG/EMPTY/COLLISION/OVERFLOW/SAFE-AREA), per-shot frame paths, and *suggested fixes* in the same vocabulary the schema uses, so an agent can loop: write → validate → fix → render → qa → fix → final, entirely on its own.

**P0.6 MCP server (`vox-mcp`).**
Expose ~8 tools (catalog, validate, compile, make-draft, qa, frame-grab, speak, align) over Model Context Protocol so ChatGPT/Claude/any tool-calling agent can drive the studio without a terminal. This replaces the CHAT-MODE paste-ball and is how Remotion is going after the same goal.

### Phase P1 — Production readiness

- **P1.1** SRT + ASS subtitle export (words.json → subtitles; caption styling already exists).
- **P1.2** `titleCard` prop (opening title + animated underline, safe-area aware) — becomes a top-3 prop immediately.
- **P1.3** `thumbnail` command (frame grab at t + title-safe crop + optional title overlay).
- **P1.4** 1:1 and 4:5 formats — one-line additions once constants are deduped (P2.1).
- **P1.5** LICENSE (MIT/Apache for code + OFL attribution for fonts + Natural Earth public-domain note), CONTRIBUTING, CI (GitHub Actions: install, test, make --draft demo), and a `vox doctor` gate in CI.
- **P1.6** Watch mode: `vox watch <name>` re-drafts on script.json save (chokidar or fs.watch), so humans and agents iterate fast.

### Phase P2 — Cleanliness (the "messy" fixes)

- **P2.1 Constant dedupe:** `core/constants.js` (FORMATS, safe areas, CAMERA_MOVES, SFX_TYPES, aspect registry); validate/qa/node.js import it. Kills the three-way drift immediately.
- **P2.2 Fix the core→tools dependency inversion:** move `registry.mjs` (prop discovery) and `fonts.mjs` into core or a `lib/` shared layer; `backends/node.js` imports from there. Then add a real `index.js` public API: `renderProject(dir, opts) → { mp4, report }` (fixes package.json main, unlocks embedding).
- **P2.3 Unified CLI:** one `vox` bin with subcommands (`vox video/validate/qa/prop/catalog/...`), keep npm scripts as thin aliases for compatibility, `vox --help` as the one true command map. 30 tool files stay but become invisible behind ~8 subcommand groups.
- **P2.4 Delete dead defensiveness:** simplify `duration()`, `makeFrameRenderer` signature probing, the commented line in helpers, fix `find()` indentation + doc order mismatch.
- **P2.5 One tape, one font system:** consolidate the three tape implementations into `_shared`; make `look.js` derive everything from theme.
- **P2.6 Doc truth pass:** fix `brief:prop` script (or the doc), fill STYLE.md QA pitfalls from the CHANGES list, add ARCHITECTURE.md with the pipeline diagram, state "English-only for now" explicitly.
- **P2.7 Lint + format (eslint/prettier) + CI enforcement.**

### Phase P3 — Scalability & performance

- **P3.1 Shot-segment render cache:** hash (shot def + theme + prop versions + asset mtimes) → reuse segment mp4s. `make` already segments; turn capture's segments into a cache keyed by content hash. ~10x faster iteration on long videos.
- **P3.2 Render profiling bench already exists (`bench`)** — add it to CI with a regression threshold.
- **P3.3 Multi-machine/cloud render story (later):** job manifest + artifact store; not needed until volume demands it.
- **P3.4 i18n path:** allow other Whisper models in align.config, document the English assumption in words.js, split language-specific logic (syllables, chunking) into a `lang/` module when needed.

### Suggested order of execution
1. **P2.1 + P2.2** (dedupe constants, fix inversion) — small, makes everything after easier and safer
2. **P0.1 recipes compiler** — biggest weak-AI lever
3. **P0.2 auto-layout/collision** — second biggest
4. **P0.3 + P0.4** one-command video + TTS default — the demo-able "wow"
5. **P0.5 + P0.6** machine-readable QA + MCP — opens it to every AI
6. Then P1 production polish, P2 remainder, P3 as needed

---

## 6. What NOT to change (protect these)

- The pure-prop contract `(o, env)` + seeded RNG + determinism tests — this is the engine's soul.
- CATALOG.md as the single generated AI-facing doc — extend it (recipes, target docs), never fork it.
- JSON-only authoring. The moment scripts become code (React/Python), weak-AI reliability dies. The recipe compiler strengthens JSON rather than replacing it.
- The validator-as-authority workflow and its "did you mean" error quality.
- The audio gate philosophy (align confidence gates) — keep it, but make TTS the default path so the gate rarely blocks.
- The paper-craft look system (one theme file, one ink, two accents) — consistency is what makes output look "high-end" regardless of which AI wrote the script.
