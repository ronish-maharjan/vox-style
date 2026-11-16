# vox-studio

Code-drawn paper-craft explainer videos. Write a JSON script → get an MP4 with voiceover, synced captions, camera moves and sound design. No AI-generated imagery; all graphics are Canvas 2D, photos are yours.

## One-time setup (needs internet once)
    npm install
    npm run bundle          # fonts, map data, python packages, Whisper model, TTS voice → everything local after this
    npm run pack            # optional: dist/vox-studio-<os>-<arch>.tar.gz for another machine (same OS)

## Make a video — the ONE command
    npm run video -- <name>              # compile → validate → audio (TTS if available) → align → draft → QA → final
    npm run video -- <name> --draft-only # stop after the draft + machine-readable report

Write `projects/<name>/intent.json` (lines + recipes, ~20 lines) and add `--from-intent`:
the compiler turns it into a full `script.json` — cue words, spans and placements are
automatic. Or write `script.json` yourself following `CATALOG.md` (the generated prop
reference). Every run writes `projects/<name>/build/video.status.json` (stage-by-stage,
machine-readable); flags and fix suggestions: `npm run qa -- <name> --json`.

Optional music: `projects/<name>/audio/music.mp3`. Other aspects: `--aspect 16:9|1:1|4:5`.

## The rest of the toolkit
    npm run catalog     # regenerate CATALOG.md — the only doc an AI needs to write scripts
    npm run compile     -- <name>   # intent.json → script.json
    npm run validate    -- <name>   # the authority on script correctness
    npm run speak       -- <name>   # local TTS narration (Piper; presets narrator|news|warm|documentary)
    npm run align       -- <name>   # Whisper word timing → words.json (gate on bad cue words)
    npm run make        -- <name>   # render with cached steps (--draft while iterating)
    npm run qa          -- <name>   # contact sheets + report: LOOK at them
    npm run subtitles   -- <name>   # SRT/VTT from word timings
    npm run thumbnail   -- <name>   # cover image (--title "TEXT" adds an overlay)
    npm run watch       -- <name>   # re-validate + re-draft on every save
    npm run mcp                     # MCP server: drive the studio from any tool-calling AI

`npx vox` (or `node bin/vox.mjs`) lists every command grouped by purpose.

## For AI agents
- Inside a repo-aware agent: follow `skills/vox-script/SKILL.md` (video) or `skills/vox-prop/SKILL.md` (new prop).
- Plain chat: `npm run brief` / `npm run brief:prop` generate paste-ready briefs (see `docs/CHAT-MODE.md`).
- MCP clients: `npm run mcp` exposes catalog/slots/validate/compile/video/qa/frame/speak as tools.

## Adding props
`npm run new-prop` → `props/<category>/<name>/index.js` (or `projects/<p>/props/<name>/`). It is auto-discovered, validated and added to CATALOG.md. See STYLE.md and props/PROTOCOL.md.

## Checks
    npm test        # core, director, renderer, props, match, determinism, compile, place, mcp …
    npm run doctor  # environment

See ARCHITECTURE.md for how the pieces fit (lib → core → backends → tools).
