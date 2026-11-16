# Prop Selection & Visual Usage Guide

This document defines when to use each available prop and how to compose it into a meaningful visual.

The objective is to translate narration into effective visual storytelling, not simply display text or randomly combine available props.

Always consult:
- `CATALOG.md` for actual prop capabilities, slots, options, defaults and restrictions.
- `STYLE.md` for the overall art direction.
- `theme.js` for the actual design tokens.

## 1. Historical storytelling and evidence

| Narration / visual purpose | Recommended prop | How to use it |
|---|---|---|
| Introduce a historical person | `paperPhoto` + `lowerThird` | Show an archival photograph as the main visual. Identify the person with their name and short historical title. |
| Show an important historical photograph | `paperPhoto` | Present the original photograph as a taped paper print. Use muted, warm or black-and-white treatment depending on the historical context. |
| Show a person or object isolated from its background | `stickerCutout` | Cut the subject out of the original photograph with an irregular paper edge, subtle shadow and optional backing. |
| Show historical evidence or a news report | `newspaperClip` | Present a torn newspaper clipping with a concise headline, short body and source. Highlight the important headline word. |
| Show an official identity or passport | `idCard` | Display a structured identity document with a name, photograph and relevant identity fields. |
| Show a historical letter or written promise | `letterPage` | Present a folded letter with its date, written message and optional signature. |
| Show confidential information or censorship | `redactedPage` | Display a typed memorandum with selected words blacked out or gradually revealed. |
| Show a memorable historical photograph with a caption | `polaroid` | Use an instant-print frame, short caption and tape. Suitable for archival moments and visual evidence. |
| Add a small archival label or exhibit identifier | `tapeLabel` | Place a short tape label across a photograph or cutout. Use it as supporting information, not a headline. |

## 2. Numbers, statistics and information

| Narration / visual purpose | Recommended prop | How to use it |
|---|---|---|
| Reveal one important number | `bigNumber` | Make the number the dominant visual. Add a short explanatory label below it. |
| Show an important year | `bigNumber` | Display the year at large scale with a concise historical explanation. |
| Compare multiple statistics | `barChart` | Use paper-cut bars to compare values. Highlight the most important bar. Keep units consistent. |
| Show a specific date | `calendarPage` | Reveal the exact date using a calendar sheet with its month, day and year. |
| Show an exact time or deadline | `clock` | Display the clock hands and digital time. Use for deadlines, midnight, countdowns and time-specific events. |
| Explain a sequence of historical events | `timeline` | Arrange dated events along a hand-drawn chronological line. Reveal the events progressively and highlight the relevant event. |
| Explain where an event happened | `baseMap` | Show the relevant geographic region, highlight the territory and add a small number of labelled location pins. |

## 3. Text, titles and annotations

| Narration / visual purpose | Recommended prop | How to use it |
|---|---|---|
| Introduce the video topic | `titleCard` | Use a large display headline with a hand-drawn underline and optional subtitle. |
| Introduce a new chapter or subject | `titleCard` | Use a shorter section heading to establish the new topic. |
| Show a short statement, date or headline | `paperScrap` | Place the text on a torn paper piece. Keep the wording short and visually prominent. |
| Identify a person or location | `lowerThird` | Place the name and short title in the identification area above the captions. |
| Explain a particular detail about something visible | `callout` | Attach a short paper label to the relevant object using its connecting line and target ring. |
| Draw attention to an existing word or number | `underline` | Draw a hand-made underline directly beneath the important text. |
| Emphasize a particular portion of existing content | `highlighter` | Animate a colored marker swipe over the relevant text or region of a photograph. |
| Draw attention to an object, face or location | `markerCircle` | Draw a marker circle, underline or box around the actual target. |
| Point toward a particular detail | `arrow` | Draw a curved marker arrow that points directly to the relevant object or location. |
| Confirm a fact, decision or successful outcome | `checkMark` | Draw a marker tick beside the item being confirmed. |
| Reject or invalidate a claim | `crossOut` | Draw a marker X, strike-through or scribble over the relevant content. |
| Present a verdict, classification or dramatic conclusion | `stamp` | Slam a short rubber-stamp word onto the page. Use the built-in overshoot treatment sparingly. |

## 4. Backgrounds and visual environments

| Narration / visual purpose | Recommended prop | How to use it |
|---|---|---|
| Establish the standard handmade paper environment | `paperBg` | Use as the base surface. Choose plain, grid, lined, dots or kraft according to the visual composition. |
| Establish the geographical or historical atmosphere | `photoBg` | Use a relevant photograph as the distant background, washed toward paper so foreground elements remain readable. |
| Create a clean graphic scene | `solidBg` | Use a simple theme color with optional graph-paper grid when no photograph or textured paper background is required. |
| Give the audience a closer look at photographic evidence | `magnifier` | Display a photograph with a magnifying lens focused on a specific important detail. Optionally move the lens to another detail. |

## 5. Transitions

| Narration / visual purpose | Recommended prop | How to use it |
|---|---|---|
| Move between ordinary shots | `wipe` | Use a clean directional wipe as a restrained transition. |
| Transition between major topics or historical sections | `paperSlide` | Use the torn-paper transition for a more noticeable chapter or subject change. |

## 6. Composition rules

### Main visual and supporting visuals

Every shot should have a clear visual hierarchy.

- Main prop: communicates the primary idea.
- Supporting prop: provides context, identification or evidence.
- Annotation: directs attention to an existing visual element.
- Background: establishes the visual environment.

Not every shot needs all four.

### Combining props

Combine props only when their purposes complement each other.

Examples:

| Composition | Purpose |
|---|---|
| `paperPhoto` + `lowerThird` | Historical person introduction |
| `paperPhoto` + `stamp` | Historical photograph followed by a verdict |
| `newspaperClip` + `highlighter` | Emphasize a reported historical detail |
| `bigNumber` + `markerCircle` | Emphasize an important statistic |
| `baseMap` + `callout` | Identify a particular geographic location |
| `paperPhoto` + `magnifier` | Examine photographic evidence |
| `timeline` + `markerCircle` | Emphasize an important event |
| `polaroid` + `tapeLabel` | Present an archival photograph with an exhibit identifier |

These are composition suggestions, not mandatory combinations. Always follow the actual prop restrictions in `CATALOG.md`.

### Important restrictions

- Never add annotations without an identifiable target.
- Never stack multiple backgrounds unnecessarily.
- Avoid displaying multiple text-heavy props simultaneously.
- Do not repeat the same visual composition throughout the video.
- Do not add supporting props merely to fill empty space.
- Preserve visual hierarchy and readability.
- Follow all documented prop limitations.

## 7. Decision-making procedure

Before creating each shot:

1. Identify the central idea of the narration.
2. Determine what the viewer needs to see.
3. Identify the appropriate visual category.
4. Select the best existing prop.
5. Decide whether supporting props are necessary.
6. Determine the visual treatment and composition.
7. Check the selected props against `CATALOG.md`.
8. Apply the global art direction from `STYLE.md`.

The narration determines WHAT needs to be shown. The prop determines HOW it is represented. The style guide determines HOW it should look.

If no existing prop communicates the idea adequately, report a missing prop rather than inventing one.

# 8. Editorial Visual Storytelling

## Core principle

Do not illustrate narration word by word.

Understand the underlying idea and determine how a viewer should visually understand it.

A visual should do at least one of the following:

- Establish context.
- Introduce a person, place or event.
- Provide evidence.
- Explain a process or relationship.
- Compare information.
- Reveal a consequence.
- Demonstrate a change.
- Create curiosity or tension.
- Reinforce an important conclusion.

A shot must have a narrative purpose. It should not exist merely because a narration line needs an image.

## 8.1 Visual storytelling categories

| Storytelling purpose | Visual approach | Suitable existing props |
|---|---|---|
| Establish a historical setting | Archival environment or geographical context | `photoBg`, `paperPhoto`, `baseMap` |
| Introduce an important character | Photograph, cutout and identification | `paperPhoto`, `stickerCutout`, `lowerThird` |
| Prove a historical claim | Primary documents and archival evidence | `letterPage`, `newspaperClip`, `idCard` |
| Explain a date or historical turning point | Large date or chronological progression | `bigNumber`, `calendarPage`, `timeline` |
| Compare two situations | Quantitative comparison | `barChart`, `bigNumber` |
| Explain a geographical relationship | Map, focus region and location markers | `baseMap`, `callout`, `arrow` |
| Explain a transformation | Before-and-after imagery across multiple shots | `paperPhoto`, `stickerCutout`, `stamp` |
| Reveal hidden information | Document with progressive redaction or revelation | `redactedPage`, `magnifier` |
| Emphasize an important claim | Hand-drawn visual annotation | `highlighter`, `markerCircle`, `underline` |
| Conclude an argument | Strong visual verdict or final statement | `stamp`, `paperScrap`, `titleCard` |

These are starting points. Select the visual approach according to the underlying story.

## 8.2 Abstract concepts and visual metaphors

Not every narration line describes a physical object.

For abstract concepts such as power, influence, tension, collapse, uncertainty, resistance or economic pressure:

1. Identify the underlying meaning.
2. Determine whether a real historical example can communicate it.
3. Consider an appropriate visual metaphor.
4. Use existing props or a sequence of shots to communicate the concept.
5. Do not invent factual evidence to make a metaphor look real.

Distinguish clearly between:
- Authentic historical evidence.
- Editorial illustrations.
- Visual metaphors.
- Reconstructed historical scenes.

Never present an illustration or reconstruction as an authentic archival photograph.

## 8.3 Visual sequencing

A complex idea may require multiple shots.

Do not force one prop to communicate everything.

A sequence may follow this editorial structure:

1. Context — establish the place, person or situation.
2. Evidence — introduce the relevant document, photograph or fact.
3. Explanation — reveal the relationship or mechanism.
4. Emphasis — focus attention on the important information.
5. Consequence — show what changed or why it matters.

This is a flexible storytelling framework, not a mandatory five-shot formula.

Every shot should advance the viewer's understanding.

Avoid repeating the same image or composition across consecutive shots unless repetition serves a narrative purpose.

# 9. Shot Composition and Cinematography

## 9.1 Visual hierarchy

Every composition should have a clear hierarchy:

- Primary subject: the most important thing viewers should notice.
- Secondary elements: details that provide context.
- Background: establishes the environment.
- Annotations: direct attention to important details.

The primary subject should remain visually dominant.

Do not make every element equally prominent.

## 9.2 Depth and layering

Use foreground, middle-ground and background to create spatial depth.

Where appropriate:
- Background photographs should sit at low depth.
- Main subjects should sit at medium or high depth.
- Supporting annotations should follow their targets.
- Camera movement should create restrained parallax.

Do not introduce depth merely for decoration.

Follow the depth, space and background rules documented in `CATALOG.md`.

## 9.3 Camera movement

Camera movement must support the narrative.

| Narrative purpose | Camera approach |
|---|---|
| Establish a location | Slow push-in or gentle drift |
| Reveal a historical photograph | Slow push-in |
| Examine a document | Controlled push-in or hold |
| Compare multiple elements | Stable framing or deliberate pan |
| Reveal a large geographical area | Slow pull-out |
| Emphasize a particular detail | Controlled push-in |
| Let important information sink in | Static hold |

Avoid unnecessary camera movement.

Never make the camera movement more noticeable than the information being presented.

# 10. Documentary Authenticity and Research

Historical and factual visuals must be accurate.

## 10.1 Image sourcing

Use authentic and relevant visual assets.

Prioritize:
1. Original historical photographs.
2. Official archives and institutional collections.
3. Original documents and records.
4. Reliable news archives.
5. High-quality contextual imagery.

Verify that the visual actually represents the person, place, period or event being discussed.

Do not use a visually similar photograph as a substitute for an actual historical event.

## 10.2 Documents and evidence

When presenting historical documents:
- Preserve the original meaning.
- Do not invent signatures, dates, official stamps or quotations.
- Use accurate document titles and sources.
- Clearly distinguish recreated documents from originals.

## 10.3 Statistics and maps

For statistics:
- Verify numerical values.
- Preserve units.
- Use consistent comparison scales.
- Avoid misleading proportions.
- Include a source where necessary.

For geographical visuals:
- Verify locations and coordinates.
- Use an appropriate map extent.
- Avoid incorrectly highlighting territories.
- Ensure map labels correspond to the actual locations.

## 10.4 Asset traceability

Maintain a record of important visual assets.

Record:
- Asset filename.
- Subject or event.
- Original source URL or archive.
- Date or historical period.
- Usage or attribution requirements.

Never fabricate a source.

# 11. Cinematic Pacing and Editorial Rhythm

A new visual does not always mean a completely new prop.

Visual changes can include:
- Camera movement.
- Crop changes.
- A new annotation.
- A document detail being revealed.
- A number appearing.
- A photograph being replaced.
- A foreground element entering.
- A change in visual scale.

Use variation to maintain attention without overwhelming the viewer.

## Pacing principles

- Introduce meaningful visual information approximately every 2–3 seconds.
- Allow important evidence and statistics enough time to be understood.
- Hold emotional or significant moments when appropriate.
- Avoid unnecessary rapid cuts.
- Avoid prolonged static compositions without narrative justification.
- Do not animate every element simultaneously.

Narrative importance determines how long a visual should remain on screen.

# 12. Sound and Motion Design

Motion and sound should reinforce the narrative.

Use sound effects for meaningful events:
- Document reveals.
- Stamp impacts.
- Paper transitions.
- Marker annotations.
- Important data reveals.
- Significant scene changes.

Do not add a sound effect to every animation.

Synchronize important visual events with narration and the director's actual timeline cues.

Use restrained transitions and consistent animation timing.

Avoid:
- Excessive whooshes.
- Random impacts.
- Unnecessary bounce animations.
- Constant camera movement.
- Transitions that distract from the story.

# 13. Visual Continuity

Maintain continuity across shots and scenes.

Check:
- Consistent color palette.
- Consistent typography.
- Consistent scale and visual proportions.
- Consistent photographic treatment.
- Consistent depth and shadows.
- Logical geographical orientation.
- Logical document and timeline progression.

A sequence should feel like one coherent documentary, not a collection of unrelated animated slides.

# 14. Production Quality Review

Before completing a video, review it in the following passes.

## Editorial review
- Does the visual explain the narration?
- Is the information presented in a logical order?
- Are important facts supported by evidence?
- Does every shot advance the story?

## Visual review
- Is the primary subject clear?
- Is the composition balanced?
- Are assets appropriate and sufficiently detailed?
- Are text and captions readable?
- Is there sufficient visual variation?

## Motion review
- Are entrances and exits smooth?
- Is the camera movement intentional?
- Are layers positioned correctly?
- Are annotations attached to the correct subjects?
- Are transitions appropriate?

## Sound review
- Is narration clear?
- Are effects synchronized?
- Are sound effects appropriate and restrained?
- Are transitions audibly coherent?

## Technical review
- Are all assets present?
- Are there any rendering artifacts?
- Are there frame-to-frame inconsistencies?
- Are all elements within the safe area?
- Does the final export match the requested aspect ratio and resolution?

Never approve a video based only on a successful render. Inspect the actual output.
