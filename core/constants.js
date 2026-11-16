// core/constants.js — the ONE source of truth for shared constants.
// Everything (core, tools, backends) imports from here; nothing duplicates these values.
// If you add a format, a camera move or an sfx type here, the validator, QA and the
// renderer all see it on their next import — no "keep in sync" comments anywhere.

/** Aspect registry: pixel size + safe margins + caption band per format.
 *  safe.bottom keeps clear of captions + platform UI. fontScale shrinks type in landscape. */
export const FORMATS = {
  '9:16': {
    W: 1080, H: 1920, orientation: 'portrait',
    safe: { top: 150, bottom: 480, left: 70, right: 70 },
    caption: { y: 1520, size: 68, maxW: 940, lines: 2 },
    fontScale: 1,
  },
  '16:9': {
    W: 1920, H: 1080, orientation: 'landscape',
    safe: { top: 70, bottom: 230, left: 110, right: 110 },
    caption: { y: 900, size: 56, maxW: 1500, lines: 2 },
    fontScale: 0.9,
  },
  '1:1': {
    W: 1080, H: 1080, orientation: 'square',
    safe: { top: 90, bottom: 260, left: 90, right: 90 },
    caption: { y: 880, size: 58, maxW: 900, lines: 2 },
    fontScale: 0.92,
  },
  '4:5': {
    W: 1080, H: 1350, orientation: 'portrait',
    safe: { top: 110, bottom: 340, left: 80, right: 80 },
    caption: { y: 1120, size: 62, maxW: 920, lines: 2 },
    fontScale: 0.95,
  },
};

export const ASPECTS = Object.keys(FORMATS);

/** Camera moves understood by core/camera.js (and validated by tools/validate.mjs). */
export const CAMERA_MOVES = ['push-in', 'pull-out', 'pan-left', 'pan-right', 'pan-up', 'pan-down', 'drift', 'tilt', 'shake', 'hold'];

/** SFX names synthesised by tools/py/sfx.py. Unknown names fall back to `tick` with a warning. */
export const SFX_TYPES = ['whoosh', 'slide', 'paper', 'swipe', 'thud', 'tick', 'pop', 'scribble'];

/** Layer keys the director understands (validated; everything else belongs in slots/options). */
export const LAYER_KEYS = ['prop', 'slots', 'options', 'at', 'until', 'depth', 'z', 'space', 'enter', 'exit', 'id', 'target', 'place'];

/** Options every prop accepts (resolved by core/helpers.js resolveGeometry / renderer). */
export const UNIVERSAL_OPTIONS = ['x', 'y', 'w', 'h', 'r', 'rot', 'scale', 'opacity', 'pad'];

/** Validate + QA pacing rules. */
export const MAX_QUIET = 3;        // seconds without a new visual or cue
export const TEXT_HEAVY = 40;      // summed string length before a layer counts as text-heavy
export const TEXT_HEAVY_MAX = 2;   // text-heavy layers allowed on screen at once
export const LONG_SHOT = 4.5;      // seconds before QA flags a shot LONG

/** Video has this much silent tail after the last word (core/director.js buildTimeline). */
export const TAIL = 0.8;
