---
name: vox-script
description: Write, validate, QA and render a Vox-style paper-craft explainer video in this repo. Use when asked to make a video, explainer or short, or to edit projects/<name>/script.json. You write only JSON; props draw everything. Never write code or edit core/, backends/, props/ or tools/ for a video task.
---

# vox-script

You write ONE file: `projects/<name>/script.json`. Narration lines, shots, props, data. Everything on screen is drawn by props listed in `CATALOG.md`.

**Authority order:** (1) the output of `npm run validate`, (2) `CATALOG.md`, (3) this file. If this file disagrees with validate, validate wins; tell the user.

## 0. Hard rules
1. JSON only. Never invent props, slots, options, cue forms or camera moves. If nothing fits, use the closest prop and end your reply with **MISSING PROPS**: name, what it should show, which shot.
2. Never invent asset filenames that you then claim exist. List real files first (`ls assets projects/<p>/assets projects/<p>`). If the story needs photos the user has not supplied, name them clearly (`signing-1984.jpg`) and give the user the exact list to provide.
3. Do not generate audio. The human makes it from `narration.txt`.
4. Freeze the narration before audio exists. Editing line text afterwards means redoing export, audio and align.
5. Leave colour options out unless you must. Palette is fixed: paper, ink, tomato, cobalt, highlight yellow.
6. Do not edit `CATALOG.md` (generated). After props change, run `npm run catalog`.
7. Do not use em dashes (—) anywhere in the output.

## 1. Workflow
```
read      CATALOG.md (all) · projects/hk1997/script.json (pattern) · ls assets projects/<p>/assets
write     narration lines first, then shots
check     npm run validate -- <p> --no-dry-run     # no words.json yet
schema    npm run schema -- --check <p>    # optional: JSON Schema check (structured-output tools)
export    npm run export -- <p>                    # writes projects/<p>/narration.txt
STOP      tell the user: make audio from narration.txt, put it in projects/<p>/audio/
          (one file named narration.* for all lines, or one per line named by id: l1.wav, l2.wav…)
          If Piper is installed and a voice exists, `npm run speak -- <p>` synthesises the
          audio locally instead — no human needed. `--dry-run` previews without synthesising.
align     npm run align -- <p>
check     npm run validate -- <p>                  # full: word: cues are resolved here
draft     npm run make -- <p> --draft
qa        npm run qa -- <p>                        # analyses the EXISTING out.draft.mp4, never re-renders
fix       edit script.json, repeat check → qa
final     npm run make -- <p>                      # report the output path that make prints
```
- Always make `--draft` before `qa`. QA is aspect-blind. For 16:9, render at 16:9 first.
- Fix → repeat steps 6–8.
- Low-confidence `word:` cue words block `align`. Change the cue word to a distinctive spoken word. Do not use `--allow-low`.
- `npm run slots -- <prop>` prints one prop's slots, options and example. Use it instead of guessing.
- QA output is in `projects/<p>/qa/`: `report.txt` (shot table, LONG/EMPTY flags, props used, duration, loudness), `sheet_NN.png` (contact sheets; the red box is the safe area), `shots/shot-NNa.png` (entrance) and `shot-NNb.png` (settled). Open the PNGs. For every shot check: nothing important crosses the red box, annotations sit on their target, no two props collide, text is readable.
- If you cannot run commands (chat mode), self-check with section 11. The user will run validate and paste errors back.

## 2. Script shape
```json
{
  "meta": { "title": "…", "aspect": "9:16" },
  "lines": [ { "id": "l1", "text": "For 156 years, Hong Kong was a British colony.",
               "caps": "For *156* years,|Hong Kong was a|British *colony*." } ],
  "shots": [ { "line": "l1", "camera": { "move": "push-in" }, "layers": [
      { "prop": "paperBg" },
      { "prop": "bigNumber", "slots": { "value": "156", "label": "years of British rule" }, "at": "word:156" } ] } ]
}
```

## Assets manifest (required for paperPhoto, baseMap textures, etc.)

 ```json
   "assets": {
     "myPhoto": "assets/photo.jpg",     // key → relative path from project root
     "mapTexture": "assets/map.png"
   },
   "shots": [{
     "layers": [{
       "prop": "paperPhoto",
       "slots": { "src": "myPhoto" }    // use the KEY, not the path
     }]
   }]
 ```

- The "assets" object is a preload manifest. Keys are lookup names; values are file paths.
- paperPhoto, baseMap, and any prop with asset type slots use the key.
- Validate ERRORS on an asset slot whose file cannot be found (looked in the project dir,
  project assets/, repo root, repo assets/). With `--draft` this becomes a warning and the
  renderer draws a "MISSING" placeholder instead.

- `meta` is optional (hk1997 has none). Default format is 9:16 (1080×1920); set `meta.aspect: "16:9"` for landscape. An explicit `--aspect` flag overrides `meta.aspect`; without the flag the script's own value wins everywhere (validate, make, capture).
- Line ids are unique. Every line needs `id` and `text`. `say` (optional) is what is spoken when it differs; **spoken text = `say` if present, else `text`**, and every cue matches the spoken text.
- Every line should have a shot. The director does not enforce this: a line with no shot just keeps the previous shot on screen.
- Shots must be in narration order. Shot 1 starts at 0; each shot ends where the next starts; silence between lines stays on the previous shot; the video has a 0.8 s tail.

## 3. Cues (read carefully, three contexts)
Forms: `start`, `end`, `t:1.5`, `word:kong`, `word:the#2` (2nd "the" in that line), each with an optional offset `+0.2s` / `-0.1s`. `word:` resolves to the **start** of the spoken word.

| Used in | `start` | `end` | `t:N` is measured from |
|---|---|---|---|
| `shot.span` | first word of the line | end of last word | line start |
| layer `at` / `until` | shot start | shot end | **shot start** |
| `sfx.at` | shot start | shot end | **shot start** |

- Matching ignores case and punctuation. A hyphenated word is one word. The cue must be in the line's **spoken** text; a miss is an error and the message lists the spoken words.
- `word:` cues search the **whole line**, but the resolved time must fall inside the shot (up to 0.25 s early is tolerated). For a line split in two shots, put each cue in the shot that covers that word.
- Pull visuals slightly early (`word:flag-0.1s`) so they land on the word.

## 4. Shots and splitting a line
- Default: one shot per line, no `span`.
- Split a line when it has two ideas or runs longer than ~4 s. If a line has N>1 shots, **every one** needs `span: [from, to]`:
```json
{ "line": "l3", "span": ["start", "word:leased"], "layers": [ … ] },
{ "line": "l3", "span": ["word:leased", "end"],  "layers": [ … ] }
```
Only each shot's `from` decides where it starts (the previous shot ends there). `to` must not run past the next shot's start.

## 5. Layers
`{ prop, slots?, options?, at?, until?, depth?, z?, space?, enter?, exit?, id? }`
- `slots` = content. `options` = look and placement. Options are never required. Slots marked required are.
- `x y w h` accept px or `"50%"` (also `r rot scale opacity` on any prop). Position is the **centre**. `length` options may also be `{portrait, landscape}`.
- A layer runs from `at` to the end of the shot. With `until` it fades out earlier. `at: "end"` means shot end minus the prop's default duration.
- Layers draw in array order: background first. Add `z` only if something must sit above a later layer (see "Unverified").
- `depth` 0 (far) to 1 (near): parallax under camera moves. Leave it off, except: **give an annotation the same `depth` as its target**, so they stay locked together when the camera moves.
- `space` is `"world"` (moves with camera) or `"screen"` (lowerThird). Leave it off.
- `id` is optional but must be unique across the **whole script**.
- Start every shot with one background layer (`paperBg` or `solidBg`), never two. Vary `paperBg` `variant` between shots.
- Two world props in one shot need different `y` (and a small `rot`), or they overlap. Check in QA.

## 6. Camera
Always the object form: `"camera": { "move": "push-in" }`. A bare string or `{type:…}` is accepted and normalised to `{move}`, but the object form is what tooling reads reliably. Verified: `move` plus optional `amount`, `focus`, `ease`.

| move | `amount` meaning (default) | notes |
|---|---|---|
| `push-in` | final zoom, must be > 1 (1.08) | use 1.05–1.15; default for most shots |
| `pull-out` | starting zoom, must be > 1 (1.08) | reveals; good for the last shot |
| `pan-left` `pan-right` `pan-up` `pan-down` | extra zoom fraction (0.06) | content slides in the named direction; 0.04–0.10 |
| `drift` | extra zoom fraction (0.06) | slow diagonal, direction is seeded |
| `tilt` | degrees (2) | ±amount, zooms to cover |
| `shake` | pixels (14) | impact only, rarely |
| `hold` | none | tiny 1.02 push; "never static" |

Do not use `amount: 0.1` on a push-in: that zooms out to 0.1×. Optional `ease`, and `focus: {x, y}` (push-in/pull-out only): leave them out unless needed. Vary moves between shots; mostly push-in.

## 7. Transitions and sound
- `"transition": { "type": "paperSlide", "duration": 0.7 }` goes on the shot that **ends** at the cut. It straddles the cut (half before, half after). It is ignored on the last shot.
- Duration defaults to 0.5 for every type regardless of the prop. Set `0.7` for `paperSlide`; `wipe` is fine at 0.5.
- Use on topic changes only, 2–3 per ~35 s, and vary the type. Plain cuts are the norm.
- `"sfx": [{ "type":"pop", "at":"word:flag", "gain":0.8 }]`. Always use an array of objects. A bare string works in the mix but makes the director throw. An `at` the mix can't resolve is silently dropped. Known types: whoosh, slide, paper, swipe, thud, tick, pop, scribble. Most props add their own sound automatically (stamp→thud, clip/photo/map→paper, highlighter→swipe, circle→scribble, number/chart→pop, lower third→slide, wipe→whoosh, paperSlide→slide), so add `sfx` only to emphasise a moment. The cue must fall inside the shot.

## 8. Captions
`caps` is optional (auto-chunks to ≤ 4 words on punctuation if absent).
- `|` splits chunks, `*word*` highlights (several words allowed), `"caps": false` hides captions for that line.
- Use the same words as `text` (just add `|` and `*`). Caps can keep digits while `say` is spelled out; they are mapped onto the spoken words.
- 2–4 words per chunk, max 6. Captions render in capitals, max 2 lines, in the bottom band.
- Highlight the one word that matters. Not every chunk needs one.

## 9. Choosing props
Pick by intent; the catalog's "Choosing props" table and each prop's **avoid** line are binding. Use `npm run slots -- <prop>` for exact slots. Known-good combinations from `projects/hk1997` (rendered and checked by the user):

| Intent | Combination |
|---|---|
| Land a statistic | `paperBg` + `bigNumber {value,label}` at the number word (+ optional `lowerThird`) |
| Proof it was reported | `paperBg` + `newspaperClip {headline, source}` (+ `lowerThird`). To emphasise a headline word use the clip's `mark` option, not a highlighter. |
| Where | `paperBg` + `baseMap {focus, pins?}` + `markerCircle` on the area |
| A person or moment | `paperPhoto {src, caption}` then `stamp {text}` at the punchline word |
| Compare values | `barChart {title, data:[{label,value}]}` with `options.highlight` = 0-based index (a number) |

- `lowerThird` slots: `name` (required) and `title`. There is no `subtitle`.
- `stamp`: 1–3 words, once per shot, only after the thing it judges is on screen.
- `paperPhoto`: at most 2 photos on screen. A real photo beats a graphic.
- Text-heavy props (clip, lower third, chart title): max 2 on screen at once; give older ones `until`.
- A project-local prop with a kit prop's name replaces it for that project. A project-local transition needs `meta.category: 'transitions'`.

**Recipes** (`## Recipes` in the catalog) are copy-paste shot snippets, not script keys. Copy the snippet into `shots[]`, add `"line"` (and `span` if needed), replace every `{{param}}`. Replace the whole quoted placeholder for non-strings: `"highlight": "{{highlight}}"` becomes `"highlight": 3`, and `"data": "{{data}}"` becomes the array. `"at": "word:{{cueWord}}"` becomes e.g. `"at": "word:156"`. Convert any `"camera": "push-in"` in a snippet to the object form.

## 10. Maps and annotations
**baseMap:** `slots.focus` is an array of place names; `slots.pins` is `[{lon, lat, label, side?}]` (max 5; the only `side` value seen is `"left"`); `options.bbox` is `[west, south, east, north]` in degrees.
Verified: `Hong Kong` and `Macao` exist.
- Valid names come from Natural Earth. **Never guess**: run `npm run geo:names -- <text>` (for example `hong`, `macao`). It prints each name and its bounding box. A name that is not in the data highlights nothing and raises no error.
- Use a tight bbox. Never a world-scale map.
- The map card fills much of the frame. Check in QA that pins and labels do not cross the red box.
- Pins: `side` is only meaningful as `"left"`, and the maximum is 8. Pins outside `bbox` vanish silently, so check them in QA.
- Setting `bbox` also sets the map's shape. Hong Kong with `[112.3,20.7,115.8,24.1]` is nearly square.
- Hong Kong and Macao exist in the data.

**highlighter / markerCircle:** `x y w h` describe the **target** on screen, not the stroke.

Preferred — `target`: give the target layer an explicit `"id"` and declared `x y w h`, then set
`"target": "<that id>"` on the annotation. It inherits the target's box (plus `options.pad`,
px or `"N%"` of the target's width), its `space` and its `depth`, so it stays glued on under
camera moves. Validate checks the id exists EARLIER in the same shot's layers.

Fallback — manual placement, when the target has no declared box:
1. Place the annotation with a best guess (percent values).
2. `npm run qa -- <p>`, open `shots/shot-NNb.png`.
3. Adjust `x y w h` until it sits on the target. Repeat.
- Placement is only valid for that exact text and photo. If a headline or caption changes, re-check.
- One annotation at a time. `markerCircle` `shape`: circle, underline or box.

## 11. Pacing, taste, and common errors
- 30–40 s total (QA warns outside 25–45 s): about 7–9 lines of 8–12 words. One idea per line, one idea per shot. A new visual or cue every 2–3 s: a 3–4 s line should have a second event (a cue layer, stamp, highlighter or sfx) on a word.
- Open with a hook (a number or a claim). Close on the point: a stamp, a big number or a pull-out.
- Prefer a photo or a big number over a paragraph. Clip headline under 10 words; body under 35.
- 9:16 content area: x 70–1010, y 150–1440 (the bottom 480 px is for captions and platform UI). 16:9: x 110–1810, y 70–850.
- The safe-area lint is narrow, so rely on the QA images for placement checks.

| Message (abridged) | Fix |
|---|---|
| `cue "word:X" not found … Spoken words: …` | Use a word from that list. If the line has `say`, cues match `say`. |
| `… resolves to N s, outside this shot` | The cue is in another shot of this line. Move the layer there or change the cue. |
| `line "L" has N shots, so each needs "span"` | Add `span: [from, to]` to every shot of that line. |
| `shot N starts … before shot M` | Reorder shots to match the narration. |
| `shot N is only 0.0xs long` | Two shots start at the same word. Fix their spans. |
| `"until" must be after "at"` | Swap or change the cues. |
| `unknown prop` / `unknown transition` | Use a name from CATALOG.md exactly. |
| `unknown slot "X" for P (slots: …)` | Use the listed slot names. Content goes in slots, look in options. |
| `missing required slot` | Add it. |
| `options.X: expected …` | Fix the type (for example `highlight` is a number). |
| `asset "…" not found` | Warning in draft: placeholder is drawn. Provide the file or fix the name. |
| `camera.move "X" unknown` | Use one of the 10 moves. |
| `duplicate layer id` / `duplicate line id` | Make them unique script-wide. |
| `words.json has no line "L"` | The script changed after align. Re-export, redo audio, re-align. |
| `director dry-run failed: ENOENT: words.json` | Use `--no-dry-run`, or run align first. |
| `N text-heavy layers (max 2 at once)` | Add `until` to the older ones or drop one. |
| `text layer extends outside the safe area` | Move or shrink it (this check ignores camera movement). |

## 12. Done checklist
- [ ] `✔ script is valid`, warnings read; `npm run schema -- --check <p>` passes when run.
- [ ] Every line has a shot. Every shot has one background and at least one event beyond the entrance.
- [ ] Cue words are distinctive; `align` confidence is fine.
- [ ] QA images opened: every annotation on its target, nothing across the red box, no overlaps.
- [ ] `report.txt`: duration 25–45 s, no EMPTY or LONG shots left unexplained.
- [ ] Missing photos listed for the user by exact filename.
- [ ] MISSING PROPS listed if you compromised.

## Unverified: test with validate/QA and tell the user, never state as fact
- **16:9:** VERIFIED — `meta.aspect` is honoured throughout (validate/make/capture); an explicit `--aspect` flag overrides it. Covered by tests/fixes.test.mjs.
- **Layer order:** how `z` combines with array order.
- **Default placement:** world props with no `x/y` centre on the safe band (x = W/2, y = safe-band centre). Covered by kit `place()`.
- **Lint limits:** exact text-heavy weight (threshold 40) and the quiet-gap limit (3).
- **Final render with missing assets:** whether `make` (no `--draft`) refuses.
- **baseMap:** default bbox when omitted.
