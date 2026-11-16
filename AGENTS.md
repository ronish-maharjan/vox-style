# Documentary Visual Production

## Required references

Before creating or modifying any video project, read and follow these references:

1. `STYLE.md` — global visual identity, art direction, typography, colors, motion, pacing and visual consistency.
2. `PROP_SELECTION.md` — visual storytelling, prop selection, visual metaphors, composition and prop combinations.
3. `CATALOG.md` — actual available props, their purposes, slots, options, defaults, durations and restrictions. This is the technical source of truth for prop capabilities.
4. `skills/vox-script/SKILL.md` — script structure, narration format, shot definitions, timing, cues and valid script-generation conventions.

Do not invent undocumented features, props, slots, options or script fields.

## Mandatory production stages

Follow these stages in order. Do not skip editorial or visual planning and jump directly into JSON generation.

### 1. Narrative analysis

Understand the documentary before designing its visuals.

Identify:
- Central subject and argument.
- Important facts, people, locations and events.
- Historical or contextual background.
- Cause-and-effect relationships.
- Main conflict, turning points and consequences.
- Intended emotional progression.
- The central message viewers should remember.

Ensure that the narration communicates a coherent story rather than a disconnected collection of facts.

### 2. Editorial breakdown

Divide the narration into meaningful narrative beats.

For each beat, identify:
- What information is being communicated?
- Why is this information important?
- What should viewers understand or feel?
- What visual evidence or explanation would help?
- How does this beat connect to the previous and following beats?

A narration line does not automatically require a separate shot. One idea may need multiple shots, while several short lines may work within one continuous visual sequence.

Prioritize storytelling over mechanical line-to-shot mapping.

### 3. Visual planning

Create a project-level `visual-plan.md` before generating `script.json`.

Use `PROP_SELECTION.md` to determine the most appropriate visual representation for every narrative beat.

For each planned visual, specify:

- **Narrative beat:** What part of the story is being communicated?
- **Visual objective:** What should the audience understand?
- **Visual concept:** How should the idea be represented?
- **Main prop:** The dominant visual element.
- **Supporting props:** Additional elements, only when useful.
- **Visual metaphor:** An appropriate metaphor for abstract ideas, when necessary.
- **Composition:** Layout, scale, hierarchy and spatial arrangement.
- **Camera:** Movement and framing.
- **Timing:** Entrance, duration and exit.
- **Audio:** Relevant sound effects or visual-audio synchronization.

Do not force every narration line into a prop.

Choose the visual approach that communicates the underlying idea most effectively.

Use:
- `PROP_SELECTION.md` for editorial prop decisions.
- `CATALOG.md` to verify actual prop capabilities and restrictions.
- `STYLE.md` for consistent visual treatment.

Never invent unsupported props or combinations.

### 4. Asset planning

Identify the visual assets needed before implementing the shots.

Consider:
- Historical photographs.
- People and portraits.
- Archival documents.
- Newspapers and official records.
- Geographic imagery and maps.
- Supporting contextual photographs.
- Other relevant visual references.

Prioritize authentic and contextually accurate visual material.

Verify that an image actually represents the person, location, event or historical period being discussed.

Distinguish clearly between:
- Authentic archival material.
- Contemporary photographs.
- Editorial illustrations.
- Visual metaphors.
- Historical reconstructions.

Never present an illustration or reconstruction as an authentic historical photograph.

Record important asset filenames, source URLs, attribution requirements and relevant context.

Respect the repository's existing asset naming and resolution conventions.

### 5. Shot composition

Translate the approved visual plan into actual shot compositions.

Determine:
- Background and environment.
- Main visual and supporting elements.
- Layer ordering and depth.
- Position, scale and visual hierarchy.
- Camera movement.
- Entrance and exit timing.
- Transitions.
- Narration synchronization.
- Sound effects.

Follow these principles:

- Give every shot one clear primary visual idea.
- Make the primary subject visually dominant.
- Use supporting elements only when they improve understanding.
- Create depth through intentional foreground, middle-ground and background layers.
- Use camera movement to support the narrative, not as decoration.
- Maintain readable compositions and respect safe areas.
- Avoid repetitive compositions and unnecessary visual clutter.
- Follow all prop-specific restrictions in `CATALOG.md`.

A documentary should feel like a continuous visual story, not a collection of unrelated animated slides.

### 6. Script implementation

Only begin script generation after completing the visual plan and asset planning.

Read `skills/vox-script/SKILL.md` and follow its exact script format.

Generate the project's `script.json` using:
- Approved narration.
- Planned narrative beats.
- Selected catalog props.
- Valid slots and options.
- Supported timing and word cues.
- Camera movements and transitions.
- Relevant sound events.
- Correct asset references.

Do not invent script properties, cue syntax or undocumented behavior.

Preserve narration wording and synchronization requirements.

The script must implement the approved visual plan rather than introduce arbitrary new visual decisions.

### 7. Rendering and QA

Never consider a successful render sufficient proof of production quality.

Validate and inspect the actual output.

Review:

**Editorial**
- Does each visual communicate the intended narration?
- Is the storytelling sequence logical?
- Are important facts and claims supported?
- Are important transitions and consequences clear?

**Visual**
- Is the subject immediately recognizable?
- Is the composition balanced?
- Are photographs and documents appropriate?
- Is typography readable?
- Is the visual hierarchy consistent?
- Are there repetitive or unnecessary visuals?

**Motion**
- Are entrances and exits smooth?
- Is camera movement intentional and restrained?
- Are layers positioned correctly?
- Do annotations follow their targets?
- Are transitions appropriately timed?

**Audio**
- Does narration synchronize with the visuals?
- Are sound effects appropriate?
- Are transition effects synchronized with the director's timeline?
- Is the audio free of unintended overlaps or timing errors?

**Technical**
- Are all assets available?
- Are there rendering artifacts?
- Are all elements inside the safe area?
- Is the requested aspect ratio respected?
- Is the output resolution correct?
- Is rendering deterministic?

Run the repository's authoritative validation:

`npm run validate`

Also follow the existing project QA and alignment requirements documented in `STYLE.md` and `skills/vox-script/SKILL.md`.

Fix identified problems rather than bypassing validation.

# Mandatory visual planning rules

Use `PROP_SELECTION.md` to determine which props best communicate each narrative beat.

Use `CATALOG.md` to verify their actual capabilities, slots, options, durations and restrictions.

Use `STYLE.md` to maintain consistent visual identity and art direction.

Use `skills/vox-script/SKILL.md` to generate valid scripts.

Never:
- Choose props randomly.
- Illustrate narration word by word without considering its meaning.
- Force unnecessary text or statistics into a shot.
- Invent unsupported combinations or features.
- Use inaccurate historical imagery as factual evidence.
- Generate the final script without completing visual planning.

If an existing prop cannot communicate an idea adequately, document the missing visual requirement instead of silently inventing a replacement.

# Working in this repository

For ordinary video production tasks:

- Never edit `core/`, `backends/` or `tools/`.
- Do not modify rendering-engine behavior to work around project-level composition problems.
- Make project-level changes using the existing supported workflow.
- Follow existing asset-loading and naming conventions.
- Preserve deterministic rendering and synchronization behavior.
- Do not bypass validation or weaken existing tests.

The repository's authoritative validation command is:

`npm run validate`

Existing engineering, determinism, audio synchronization and QA rules remain mandatory.

Do not modify shared infrastructure as part of an ordinary video-production task. Report infrastructure limitations separately when they genuinely prevent production.
