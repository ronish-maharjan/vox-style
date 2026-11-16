# CHANGES — Phase 0 correctness pass + the three "any-AI" PRs

Date: 16 November 2026 · Baseline: main @ 87b6cb5 · Result: `npm test` 147/147 green
(was 43/45 with 2 failing on a fresh clone), full `npm run make -- test10 --draft`
pipeline verified end-to-end (validate → sfx → mix → capture, 1044 frames).

Everything below follows the delivered code review (3 critical / 6 major / 41 other)
and the "Any AI, Any Video" blueprint's first three PRs.

## Critical fixes

- **C1 — transition SFX fired on the wrong shot.** `tools/lib/events.mjs` re-derived
  transition timing from the raw script (anchored to the *start* of the declaring shot,
  guarded by "skip first shot"), disagreeing with the director (end of shot, skip last).
  Transition sounds now derive from the director's own `tl.transitions[]`, so audio and
  visuals can never disagree. Test: `tests/fixes.test.mjs` (C1).
- **C2 — `script.meta.aspect` was silently ignored.** Every CLI entry point passed an
  explicit `9:16` default that defeated the script's own declaration. Fixed across
  `tools/capture.mjs`, `tools/validate.mjs`, `tools/bench.mjs`, `tools/render-range.mjs`
  and `backends/node.js` (which now also sizes the canvas from the *resolved* aspect).
  Resolution order everywhere: `--aspect` flag > `script.meta.aspect` > `9:16`.
  Tests: C2 (loadProject + validateProject) and M3 (CLI).
- **C3 — red suite + catalog/fixture drift.** The `test10` fixture used props that
  exist nowhere (`timelineTrack`, `imageTimelineCard`) and declared 7 photo assets that
  were never committed. The fixture now uses real props (`timeline`, `paperPhoto`), the
  declared assets exist as deterministic stand-ins (`projects/test10/assets/`), the dead
  prop references were removed from `timeline`/`paperScrap` meta text (the catalog's
  `quoteCard` mention was another instance the new test caught), and a catalog
  self-consistency test now extracts every camelCase token from CATALOG.md + prop meta
  and asserts each is a real prop or a declared key.

## Major fixes

- **M1** — director recorded `sfx.volume`, the audio path reads `gain`; unified on `gain`
  (the documented field). 
- **M2** — `tools/render-range.mjs` swallowed ffmpeg EPIPE and could hang forever on a
  crashed encoder; every stdin backpressure wait now races against encoder exit and
  fails fast with the collected stderr.
- **M3** — `tools/validate.mjs` hand-rolled flag parsing picked `--aspect 16:9`'s value
  as the project name; now uses `parseArgs` (like `make`). 
- **M4** — `tools/make.mjs`'s cache walker descended into `.build/capture` (capture's
  segment output), busting the render cache every run; the walker now skips all
  dot-directories.
- **M5** — `shot.sfx` was never schema-validated: a bare string passed validate and
  threw `sfx.forEach is not a function` deep in the director. sfx entries are now fully
  validated (array of `{type, at, gain}`, known sfx types).
- **M6** — the validator's `length` type accepted any non-empty string (`'50pxX'`
  passed, and the legitimate `{portrait, landscape}` form was *rejected*). The check now
  delegates to `core/protocol.js`, so validator and runtime share one grammar.

## Minor fixes

- **#1** cue-word normalisers disagreed on apostrophes (align gate matched `dont` ↔
  `don't`, director threw); one shared `matchKey` in `core/words.js` is now used by
  `tools/lib/cues.mjs` and the director.
- **#2** `tools/preview.mjs` path check served sibling directories sharing the ROOT
  prefix; proper `path.relative` containment check.
- **#3** kit `place()` defaulted unpositioned props to raw screen centre (inside the
  caption band in 9:16); now defaults to the safe-band centre.
- **#9** `capture --workers` with no value became NaN → zero workers; falls back to the
  default now.
- **#10** `tools/bench.mjs` arg scanning swallowed a positional after a boolean flag;
  `parseArgs` now.
- **#11** overflowing caption chunks drew every wrapped line; capped at the configured
  `captions.lines`.
- **#12** `make` mtime staleness check false-positived after fresh clones/branch
  switches; audio + words.json are now tracked by a content hash once a run succeeds
  (mtime check remains for the first run — see Known limits).
- **#13** `transcribe.py` hardcoded English; `--language` flag (align.config.json
  `"language"`) with auto-detect for non-`.en` models.
- **#14** mixdown SFX gain was a hidden fixed 0.5; `mix.py --sfx-gain` (default 0.5,
  backward compatible).
- **#15** STYLE.md documented a non-existent `tools/lib/paths.mjs` and claimed `..`
  rejection; now documents the real resolution order.

## PR1 — bounds registry + `target` annotations

`core/renderer.js` registers every active layer's declared box (id → x/y/w/h/space/depth)
each frame. A layer with `"target": "<earlier layer id>"` inherits that box — plus
`options.pad` (px or `"N%"` of the target width), the target's `space` and `depth` — so
`markerCircle`/`highlighter` lock onto their targets and stay locked under camera moves,
replacing the skill's mandatory guess→QA→adjust loop for anything with declared geometry.
`validate` enforces that `target` names an earlier layer's explicit `id` in the same
shot. Strict renders fail with a clear message when a target has no box; the renderer
exposes `renderer.bounds()` for tooling.

## PR2 — JSON Schema pipeline (model-agnostic authoring)

- `tools/lib/schema.mjs` — generates draft-2020-12 JSON Schema for every prop
  (`propSchema`) and for whole scripts (`scriptSchema`: lines/shots/camera/layers/
  transitions/sfx/assets, with per-prop `if/then` discrimination on `prop`). Feed it to
  any model's structured-output / function-calling and scripts are valid by construction.
- `tools/lib/schema-check.mjs` — dependency-free checker for the emitted subset.
- `npm run schema -- --script | --prop <name> | --out <dir> | --check <project>`.
- `tests/schema.test.mjs` — every prop generates a coherent schema, the script schema
  covers all 30 props, and the demo/hk1997/test10 scripts pass with planted errors
  caught. (Building this already paid off: it flagged that options must never be
  required, transitions accept `slots`/`options`, and bare-string cameras are legal.)

## PR3 — local TTS behind a flag (the human audio stop becomes optional)

`tools/speak.mjs` (`npm run speak -- <project> [--voice …] [--dry-run] [--force]`):
synthesises each line to `projects/<p>/audio/<lineId>.wav` with a local Piper voice
(resolution: `--voice` > project `voice.onnx` > `voices/*.onnx` > `$PIPER_VOICE`),
then the existing `align` + `make` flow works unchanged. Clear exit codes and install
hints when piper or a voice is missing; nothing changes for anyone who does not opt in.

## Documentation

- `skills/vox-script/SKILL.md`: audio step now offers `npm run speak`; the false "validate
  does NOT warn about missing assets" claim corrected; the camera bare-string claim
  corrected; annotations section rewritten around `target` (manual loop kept as
  fallback); the dead `timelineTrack`/`imageTimelineCard` line removed; the Unverified
  entries for 16:9 and default placement are now answered in code and tests; optional
  `npm run schema -- --check` added to the workflow and checklist.
- `skills/vox-prop/SKILL.md`: stale `imageTimelineCard` "known failure" notes removed;
  annotation `target` documented.
- `CATALOG.md` regenerated (30 props, 10 categories, 5 recipes) from the fixed meta.

## Known limits (honest list)

- `#12` first-run-after-clone can still trip the mtime check if git happened to check
  out audio after words.json; the content-hash bypass kicks in from the first
  successful make onward. The proper fix is hashing words.json content against audio
  content unconditionally (phase 1).
- The bounds registry records *declared* geometry; a target layer needs explicit
  x/y/w/h (universal options every prop honours). Props with fully internal
  auto-layout are not targetable until a `meta.box` convention lands (blueprint L5).
- No new integration test for the M2 hang (needs a crashing ffmpeg); the fix is
  code-reviewed and the render-range path is exercised by every capture.
- Piper word timestamps are not wired yet: `speak` + `align` (Whisper) is the current
  pair; piper-native timestamps are the blueprint's follow-up so align becomes a
  fallback only.
- The remaining phase-1..5 items (one arg parser module, MCP tool surface, skins,
  tween engine, media layers) are unchanged in scope — see the blueprint document.

---

# Any AI, Any Video — improvement pass 1 (P0/P1/P2)

Date: 16 November 2026 · Baseline: main @ 9ca4035^ (87b6cb5 lineage) · Result: `npm test` 169/169 green.
Follows docs/IMPROVEMENT-PLAN.md. Every phase is one commit; `git log --oneline` is the changelog.

## Phase P2 first (made everything after it safer)

- **P2.1 constants**: `core/constants.js` is now the single source for FORMATS
  (+ new 1:1, 4:5), ASPECTS, CAMERA_MOVES, SFX_TYPES, LAYER_KEYS, UNIVERSAL_OPTIONS,
  pacing thresholds. theme/camera/validate/qa/backends all import it; the
  "keep in sync with core/theme.js" comments are gone.
- **P2.2 layering**: `lib/` (registry, fonts) extracted from tools/; backends/ and
  core/ no longer depend on tools/. Public `index.js`: `renderProject()` one-call API
  + engine re-exports. Asset search order now matches the documented order everywhere.
  Dead defensiveness removed (renderer signature probing, helpers tape()).

## Phase P0 — "any AI, any video"

- **P0.1 recipe compiler** (`npm run compile`): intent.json (lines + `{recipe,
  params}`) → full script.json. Automatic distinctive cue-word picking (stopwords,
  uniqueness, digit bonus, position-bounded so cues land inside their sub-shot),
  automatic span splitting for multi-shot lines, unfilled params fail loudly,
  compiled output validated before write. 7 tests. **A weak model writes ~20 lines
  and gets a 300-line script that validates first try.**
- **P0.2 auto-layout**: `place: center|upper|top|lower|bottom|stack|{x,y}` resolves
  in the director; bounds registry registers placed layers via new optional
  `meta.defaultSize` (declared on 13 content props) so annotations can `target:`
  lock onto them; validate warns on content-layer collisions with a concrete fix
  suggestion. 7 tests, no false positives on existing projects.
- **P0.3/P0.4 one command** (`npm run video`): compile → validate → audio
  (existing > Piper TTS > estimated, `--strict-audio` to enforce) → align → draft →
  qa → analyze → final. Stage status JSON at projects/<p>/build/video.status.json.
  TTS voice presets (narrator|news|warm|documentary); setup:audio downloads the
  narrator voice so a fresh clone renders a narrated MP4 with zero human steps.
- **P0.5 machine-readable QA**: `tools/analyze.mjs` is the single QA core (used by
  qa --json, video, MCP, renderProject): shot table, LONG/EMPTY/COLLISION flags,
  suggestions in the same vocabulary as validate, loudness.
- **P0.6 MCP server** (`npm run mcp`): dependency-free MCP 2024-11-05 over stdio;
  8 tools (catalog/slots/validate/compile/video/qa-report/frame/speak). 5 tests
  including the full agent loop over MCP.

## Phase P1 — production readiness

- **subtitles**: SRT/VTT from words.json (or estimated), chunk timing identical to
  on-screen captions. **titleCard** prop (display headline, self-drawing marker
  underline, typed subtitle wipe). **thumbnail** command (smart default frame +
  title overlay). **1:1 and 4:5 formats** wired end-to-end. **LICENSE (MIT) +
  THIRD-PARTY.md** (OFL fonts, Natural Earth CC0, ffmpeg binary note, setup-time
  downloads). **CI** (tests + draft render + full video pipeline + MCP + catalog
  freshness gate). **watch mode** (save → revalidate + re-draft, ~2s).

## Phase P2 remainder

- **vox CLI hub** (`npx vox`): 33 commands grouped by purpose; npm scripts kept.
- **doc truth pass**: brief:prop script wired (CHAT-MODE.md referenced a missing
  script), STYLE.md QA pitfalls filled from C1-C3/M4/M5, ARCHITECTURE.md written
  (layering diagram, data path, AI-surface table), README rewritten around the one
  command, catalog header documents place:/target:/pad and the new formats.
- **encode tuning**: final render CRF 18→23 + `-tune grain` (the paper-grain
  overlay is high-entropy noise; 12.4s 1080x1920 went 66.9 MB → 39 MB with the
  texture intact). Draft CRF 24→28.

## Updated known limits

- The grain overlay keeps final bitrates around 25-30 Mbps at CRF 23/tune grain;
  platforms re-encode anyway, but a `--crf` passthrough on make/capture would be
  nice for size-sensitive targets.
- Piper-native word timestamps still not wired (speak + Whisper align remains the
  pair); blueprint follow-up.
- Collision lint is geometric (declared/resolved boxes); props with fully internal
  auto-layout (no x/y/w/h anywhere) are exempt rather than probed — a frame-level
  bounds dump would close that (analyze already has the pieces).
- English-only pipeline (small.en default, English stopwords in the compiler's cue
  picker); i18n remains a module-split away.
