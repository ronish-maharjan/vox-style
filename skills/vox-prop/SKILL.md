---
name: vox-prop
description: Create or modify a prop (a code-drawn visual component) for this video studio. Use when the user asks for a new visual element (chart, card, map, transition, annotation…), or when a video script needs something CATALOG.md does not have (a MISSING PROPS item). Output is one props/<category>/<name>/index.js (or a project-local one) that passes tests, validate and a visual QA.
---

# vox-prop

A prop is one file that draws one visual idea with Canvas 2D and describes itself in `meta`. Other AIs choose props only from `meta.use` / `meta.avoid` in `CATALOG.md`, so the metadata is as important as the drawing.

**Authority order:** (1) the repo's tests and `npm run validate`, (2) the real source files (`props/PROTOCOL.md`, `core/*.js`, `props/_shared/*.js`, reference props), (3) this file. If this file disagrees with the source, the source wins; tell the user.

## 0. Before writing anything
1. Read `CATALOG.md`. If existing props can be composed to do the job (for example `paperBg` + `bigNumber` + `highlighter`), say so and do not build. Build only a genuinely new visual idea. One prop = one idea.
2. Read, in full: `props/PROTOCOL.md`, `props/_template/index.js`, `STYLE.md`, `props/_shared/look.js`, `props/_shared/shapes.js`, `core/helpers.js`, `core/theme.js`, `core/easing.js`.
3. Read at least one reference prop of the same kind, then copy its structure:
   - annotation or animated sprite: `props/annotations/stamp/index.js`
   - uses a photo: `props/photos/paperPhoto/index.js`
   - data or counting animation: `props/data/barChart/index.js`
   - transition: `props/transitions/wipe/index.js` (mandatory for transitions: the `o.progress` contract is not fully described in the protocol)
4. If the user's request is missing something you need (slots, limits, when not to use it), ask once, briefly. Do not guess content limits.

## 1. Where the file goes
- **Kit prop** (reusable): `props/<category>/<name>/index.js`. Use an existing category folder if one fits.
- **Project-local prop** (one video): `projects/<project>/props/<name>/index.js`.
- Default: project-local if the request came from a video; kit if the user says "add to the library/kit".
- The folder name MUST equal `meta.name`. `meta.name` is camelCase letters and digits only, unique across `props/` (check `ls props/*/`). `meta.category` is what the catalog groups by; keep the folder category equal to it.
- Do not use any scaffolding script. Create the folder and file by hand.
- Only `export default { meta, draw }`.

## 2. The contract (verified against core/protocol.js and the real props)
```js
export default { meta: {…}, draw(ctx, o, env) {…} }
```
**meta** — all required except where marked:
| field | rule |
|---|---|
| `name` | camelCase, = folder name |
| `use` | string. "Choose this when…". The one sentence another AI reads to pick this prop. |
| `avoid` | string. "Do not…". Include concrete limits (max items, max characters, max on screen). |
| `slots` | object (may be `{}`). Content: text, photos, data. |
| `options` | object (may be `{}`). Look and placement. |
| `defaultDuration` | number > 0, seconds. Also used by `"at":"end"`. |
| `example` | object `{ slots, options }`: must be a layer that validates and renders. |
| `category` | optional but set it. |
| `space` | optional: `world` (moves with the camera) or `screen`. |
| `depth` | optional 0..1 (0 far, 1 near; default 0.5). |
| `enter` | optional seconds: length of the entrance. |
| `enterEase` | optional: must be a name exported in `EASES` from `core/easing.js`. |

- A name may not be both a slot and an option.
- **Type strings:** `string number boolean asset color length array object any`, suffix `?` for optional, `enum:a|b|c`, `range:0..1`. Nothing else parses.
  - `length` = px number, `"50%"`, or `{portrait, landscape}`. For anything structured (arrays of objects, per-orientation values) declare `any` or `array`.
  - **Every key in `example.options` and `example.slots` must be declared in `meta`, and its value must satisfy the declared type** (the catalog test enforces this).
- `x y w h r rot scale opacity` are accepted on every prop by validate (universal options). Do not redeclare them unless you want them documented in the catalog; the template does.
- Only `x`, `cx`, `y`, `cy`, `w`, `h`, and `r` are resolved as lengths automatically. Any other length option must be resolved explicitly with `resolveLen`.
- **Annotation props** (highlighter, markerCircle): `x y w h` describe the **target** on screen, not the mark. A script may instead set the layer key `"target": "<layer id>"` to inherit another layer's declared box (plus `options.pad`, px or `"N%"`).

**draw(ctx, o, env)**
- `o` is one flat object: all slot values plus all option values. `x y w h` are px numbers when the script gave them and `undefined` otherwise, so choose your own defaults with `num(o.x, default)`. `rot` is in **degrees**. `o.appear` and `o.exit` are 0..1, already eased (`exit` 0 = not leaving; without `until` a layer never exits). Clamp `appear` before using it (`anim(o)` does), because an overshoot ease can push it past 1. A transition also gets `o.progress` (0..1; 0.5 = fully covered).
- **Never read `o.opacity` in a prop.** The renderer sets `ctx.globalAlpha = o.opacity` before calling `draw`. Multiplying by `o.opacity` again applies opacity twice. For example, script opacity `0.5` becomes an effective alpha of `0.25`.
- `env = { id, t, p, W, H, orientation, safe, theme, assets, words, rng(label), createCanvas, sprites }`. `t` is shot-local seconds, `p` is shot progress 0..1, `words` are the spoken words with shot-local times.
- **A prop cannot see its own layer age.** Anything that animates after frame one must be driven by `o.appear` and `meta.enter` (bars growing, numbers counting). Endless wobble may use `env.t` (it stays a pure function of the inputs).
- Position = **centre**. Default placement should sit inside the safe area: `const m = margins(env)` gives `{top,bottom,left,right}`.
- The canvas is 1080×1920 (portrait) or 1920×1080 (landscape). **Every prop must look right in both**: branch on `env.orientation` or compute from `env.W/env.H`.

## 3. Rules (from STYLE.md and PROTOCOL.md)
**Pure.** No `Math.random`, `Date.now`, `performance.now`, `document`, `window`, `new Image`, `OffscreenCanvas`, `fetch`, `fs`, or module-level mutable state. Randomness: `env.rng('label')` inside `draw`; inside a sprite painter seed from the content: `seededRandom(hashStr(key))` (see stamp). The same `(o, env)` must give identical pixels in any render order.
- Banned substrings must not appear anywhere in non-`//` lines, including strings and trailing comments.

**Imports.** Only `vox-studio/core/...` and `vox-studio/kit/look.js` / `vox-studio/kit/shapes.js`. Never `../` out of the prop folder, never `@` aliases, never npm packages.
- `look.js` exports: `clamp01 num paint font anim margins place cached imageOf rngFor toRGB rrect drawTape`.
- `shapes.js`: `backOut`, `fitFont` are used by stamp; open the file for the rest. Do not call a helper you have not seen defined.
- `core/helpers.js`: `dropShadow(ctx, theme, fn)`, `fitText(ctx, text, {maxW, maxH, family, weight, maxSize, minSize, lineHeight})` → `{size, lines, lineHeight}`, `sprite`, `hashStr`, `seededRandom` (has `.range(a,b)`), `resolveLen`. Open the file for the complete list.
- After `fitText`/`fitFont`, set `ctx.font` yourself before drawing or measuring. Existing props rely on the helper leaving it set; do not.

**Look.** Every colour, font and weight comes from the theme:
- Colours: `paint(theme, name)`. Names: `ink inkSoft paper paperDark white accent1 accent2 highlight kraft tape shadow` (aliases `tomato red cobalt blue yellow`). No hex literals. The only accepted exception is a black used in a `destination-out` mask (stamp does this).
- Fonts: `font(theme, kind, size)` with kind `display` (headlines, numbers) or `text` (small labels). `typed` and `serif` are for document-like props only. Never write a family name.
- Prefer `theme.line`, `theme.shadow`, `theme.edge` (torn edge) and `dropShadow` for strokes, shadows and paper edges.
- Palette discipline: paper, one ink, tomato and cobalt, one yellow highlight. A prop uses at most two of the accents. Do not invent colours.
- Motion: entrances 150–400 ms ease-out. Overshoot (`backOut`) only for stamps and pins. Nothing may pop in at full opacity on frame one: use `o.appear`.
- Handmade feel: small seeded wobble, torn edges, soft shadow. No perfect geometry.

**Safety.**
- Always `ctx.save()` … `ctx.restore()` in balance; return early (before `save`) when invisible.
- Missing asset: `imageOf(env, src)` returns `null`; draw a placeholder or another meaningful fallback, never throw. The props test replaces every asset-typed slot and option with `does/not/exist.png` and makes `env.assets.get` return `null`. The prop must still draw something.
- Empty optional slots must not leave holes or throw. Check `undefined`, `''`, and empty arrays.
- Text must fit: use `fitText`/`fitFont` with a max width inside the safe area. Test the longest realistic text from the request.
- Heavy pixel work (grain, torn edges, paper textures) goes in `cached(env, key, w, h, painter)`. The `key` must contain **every** input that changes the pixels (text, colour, size, shape, seed, orientation if it matters). The props test checks this by comparing a cold draw with a warm draw.
- Canvas features: use what existing props already use (paths, `arcTo`, `drawImage`, `multiply`, `destination-out`, `translate/rotate/scale`, `measureText`, `strokeText`). The render backend is skia-canvas and the preview is a browser; anything else (`filter`, `letterSpacing`, `roundRect`, `Path2D`, `ellipse`…) is untested here, so use it only if you verify it in a render.

**File.**
- Under about 300 lines. Keep everything in `index.js`. If it will not fit, simplify the prop.
- Line 1 is a comment in the same shape as stamp: `// props/<category>/<name>/index.js — what it draws. Usage: { "prop":"<name>", "slots":{…}, "options":{…}, "at":"word:x" }`.
- A short comment above each non-obvious block. No dead code.

## 4. Writing `meta` well (the catalog is your only user interface)
- `use`: one or two sentences naming the situation, not the implementation. Good: "Compare 2–6 values with paper-cut bars…". Bad: "A chart component".
- `avoid`: concrete limits and the right alternative: "More than 8 bars, labels longer than about 10 characters. For a single number use bigNumber."
- Slots are the content a script author writes; options are optional looks. Give every option a sensible default in code. A script must work with `options: {}`.
- Choose `defaultDuration` as the time the prop needs from entrance to a readable settled state plus about one second.
- Pick `space`/`depth`: backgrounds depth ≤ 0.3, props 0.4–0.7. `space: 'screen'` for overlays that must not move with the camera.

## 5. Verification loop (in the repo)
```
1  create file
2  npm run test:props                  new prop must pass every check
**What the props test does not cover:**
- It always passes `opacity: 1` and calls props directly, without going through the renderer. It cannot detect double application of opacity.
- It does not run the camera, renderer, or layer ordering. A passing test does not guarantee correct placement or appearance in a real shot.
- QA PNGs are therefore the real visual check. Open them and inspect the actual rendered shots.
3  npm test                            the suite must be fully green
4  npm run catalog                     open CATALOG.md: does your entry read well? example valid?
5  npm run slots -- <name>             slots/options/example as scripts will see them
6  sandbox project (below) → npm run validate -- proptest
**Draft validation caveat:** When any asset is missing, `validate --draft` skips the dry-run. Cue errors may therefore remain undetected until rendering, where they can surface as an exception. Do not treat a successful draft validation as proof that all cues resolve.
7  npm run qa -- proptest              OPEN the PNGs in projects/proptest/qa/
8  fix → repeat 2–7
9  append anything you learned to STYLE.md under "QA pitfalls"
```
**Sandbox (provisional):** Copy `projects/test10` to use as the sandbox. Edit layers only. Do not finalise or modify other parts until the user has provided the listing below. with 2–3 short lines and three shots: (a) the `meta.example` layer on `paperBg`; (b) a stress case (longest text, most items, every optional slot empty, `rot` set); (c) the prop together with a neighbour it will realistically share the screen with. Use real cue words from the line text, and the object camera form `{ "move": "push-in" }`.

In the QA images check every shot, both entrance (`shot-NNa`) and settled (`shot-NNb`): nothing crosses the red safe box, text is not clipped or overlapping, the placement is believable, the entrance is not a pop, the stress case does not break. For 16:9 use any aspect flag `validate`/`qa` accept (`validate` has `--aspect 16:9`); if you cannot render 16:9, say it is untested.

Tell the user the sandbox exists; delete it only if they ask.

## 6. Chat mode (you cannot run anything)
You cannot run tests. Do the checks mentally against the real test files in your brief, and reply with exactly:
1. **PATH:** the file path.
2. **FILE:** the complete `index.js` in one code block.
3. **SANDBOX:** a `script.json` for `projects/proptest/` in one code block.
4. **COMMANDS:** the verification commands from section 5 (steps 2–7).
5. **SELF-CHECK:** the section 8 checklist, each item answered yes/no with a one-line reason.
6. **UNSURE:** every place you were not certain (a helper signature, a canvas feature, a limit). The user will paste failures back; fix with the smallest change and reply with the complete file again.

## 7. Mistakes that have already happened
- Example option not declared in `meta.options`, or an object used where `length` is declared (catalog test fails).
- Over 300 lines.
- Folder name ≠ `meta.name`; a slot and an option with the same name; `enterEase` not in `EASES`.
- A cache key missing an input (frames differ by render order; `tests/determinism.test.mjs` catches it).
- Entrance driven by `env.t` instead of `o.appear`.
- Relative imports out of the folder; hex colours; font family strings.
- Annotation placed by guess without looking at the QA frame.
- A text prop drawn without a max width, spilling into the caption band (bottom 480 px in 9:16).

## 8. Acceptance checklist
- [ ] Not duplicating an existing prop; one idea.
- [ ] Folder name equals `meta.name`; transitions set `meta.category`; line 1 comment with Usage; ≤ 300 lines; only default export.
- [ ] meta complete; `use`/`avoid` concrete; example valid against declared types.
- [ ] Pure: no random/time/DOM/globals; every cache key complete.
- [ ] Theme only: no hex (except a mask), no family strings.
- [ ] Works with `options: {}`, empty optional slots, missing asset, longest text.
- [ ] Looks right in 9:16 and 16:9 (or 16:9 stated as untested).
- [ ] Entrance via `o.appear`; nothing pops; save/restore balanced.
- `tests/props.test.mjs` is only partially inspected: lines 1–80 (checks 1–4). Do not claim full test coverage or mark the remaining checks complete until the rest of the file is inspected.
- [ ] QA images opened; safe area respected.

## Unverified (check, and tell the user; never state as fact)
- How `npm run scan` relates to discovery, and whether project-local props need it.
- Exactly how the renderer maps `meta.enter` to `o.appear` and how a transition receives the outgoing/incoming scene (read `core/renderer.js` and `wipe`).
- What `tests/props.test.mjs` checks beyond the list above (its source is in the brief).
- Canvas 2D features beyond those existing props use, under skia-canvas.
