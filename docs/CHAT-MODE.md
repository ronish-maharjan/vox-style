# Using the studio from a plain chat (the AI cannot run commands)

If the AI runs **inside the repo** (Claude Code style), send nothing: say
- video: "Make a video about <topic>. Follow skills/vox-script/SKILL.md."
- prop: "Build this prop: <request>. Follow skills/vox-prop/SKILL.md."

Everything below is for a plain chat window. The brief files are generated; never edit them by hand.

## A. A video script
1. Put the photos you have into `assets/` (the brief lists them; the AI may use only those).
2. `npm run catalog` (only if props changed), then `npm run brief -- <project> --topic "your topic"` → `projects/<project>/BRIEF.md`.
3. New chat. Paste **all** of BRIEF.md, then: "Write projects/<project>/script.json for the topic above. Reply with one JSON block, then a list of MISSING PROPS and missing photos (exact filenames)."
4. Save it, run `npm run validate -- <project>`, paste any errors back verbatim, repeat until `✔ script is valid`.
5. Continue as normal: export → make audio → align → `make --draft` → `qa`. To get fixes, send the AI `report.txt` and `sheet_01.png`.

## B. A new prop
1. Write the request (template below). If it came from a script AI's **MISSING PROPS** list, copy name, what it should show, and which shot straight into the request.
2. Save the request as `my-request.md`, then generate the brief. Choose reference props that match the job:
   | Prop kind | `--like` |
   |---|---|
   | stamp / annotation / sprite animation | `stamp` |
   | uses a photo | `stamp,paperPhoto` |
   | chart / counting animation | `stamp,barChart` |
   | document / card | `stamp,newspaperClip` |
   | transition | `wipe` (and `paperSlide`) |
   ```
   npm run brief:prop -- --like stamp,paperPhoto --request my-request.md
   ```
   → `PROP_BRIEF.md` in the repo root (about 15–20k tokens; use a model with a long context).
3. New chat. Paste **all** of PROP_BRIEF.md. The AI must reply with PATH, FILE, SANDBOX, COMMANDS, SELF-CHECK, UNSURE.
4. Save FILE at PATH and SANDBOX at `projects/proptest/script.json`, then run COMMANDS.
5. If anything fails, paste the output **verbatim** (below) and say "fix with the smallest change; send the complete file again".
6. When tests pass and the QA images look right: `npm run catalog`, open the CATALOG.md entry, commit.

## What to paste back when something fails
| Failure | Paste |
|---|---|
| `npm run test:props` / `npm test` | the failing test block, whole |
| `validate` errors | the whole output |
| It renders but looks wrong | `projects/proptest/qa/shots/shot-NNb.png` (the image itself) plus one sentence on what is wrong |
| Catalog entry reads badly | the entry text and what you wanted it to say |

## Request template
```
Name (camelCase, unique):
Where: kit category ___ | project-local in projects/___
What it shows (describe the picture: shapes, layout, motion):
Choose it when:
Do NOT use it when (concrete limits: max items, max characters):
Slots (name, type, required?):
Options (name, type, default):
Timing (how long it stays; how it enters; anything after entering):
Space: world | screen; depth 0..1:
How 9:16 and 16:9 should differ:
Reference (describe a picture, or name an existing prop it resembles):
Sample content, plus the longest realistic text:
```
Be specific about limits. "At most 5 items, each label up to 12 characters" gets a better `avoid` line and a prop that fits.

## What the prop AI is told (so you know what it knows)
The prop protocol, template, style rules, theme, easing, core helpers, kit helpers, the validator's type grammar, the real prop and import tests, the renderer, the list of existing props, and 1–3 full reference props. It is told to reuse only helpers it can see, to build only if existing props cannot be composed, and to list every uncertainty.

## C. MCP clients (newest, best)
If your chat tool supports Model Context Protocol, skip the paste entirely:
run `npm run mcp` (or point the client at `node mcp/server.mjs`). The studio
exposes eight tools: vox_catalog, vox_slots, vox_validate, vox_compile,
vox_video, vox_qa_report, vox_frame, vox_speak. The agent can plan, write,
validate, render and QA a video without a terminal at all.
