// tools/validate.mjs — check a project's script.json against the prop catalog.
// Usage: npm run validate -- <project> [--aspect 9:16|16:9] [--json] [--no-dry-run] [--draft]
// Exit code 1 on errors or MISSING PROPS. Warnings never fail.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { discoverProps, toDefs, ROOT } from '../lib/registry.mjs';
import { normSpec, checkValue, isRequired } from './lib/types.mjs';
import { FORMATS, ASPECTS, CAMERA_MOVES, SFX_TYPES, LAYER_KEYS, UNIVERSAL_OPTIONS, MAX_QUIET, TEXT_HEAVY, TEXT_HEAVY_MAX } from '../core/constants.js';

export { LAYER_KEYS, CAMERA_MOVES, SFX_TYPES };

// Formats come from core/constants.js (single source of truth, shared with theme/qa/backends).
const FORMAT_LIST = ASPECTS.join('|');

const CUE_RE = /^(?:start|end|t:\d+(?:\.\d+)?|word:\S+?)(?:[+-]\d*\.?\d+s)?$/;
const PLACEHOLDER = /\{\{[^}]+\}\}/;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const hasPh = (v) => PLACEHOLDER.test(JSON.stringify(v) ?? '');
const mapSpecs = (o) => Object.fromEntries(
  Object.entries(o ?? {}).map(([k, v]) => [k, normSpec(v)])
);

function lev(a, b) {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i]);

  for (let j = 1; j <= b.length; j++) m[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      m[i][j] = Math.min(
        m[i - 1][j] + 1,
        m[i][j - 1] + 1,
        m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }

  return m[a.length][b.length];
}

function closest(name, list, strict = false) {
  let best = null, bd = Infinity;

  for (const c of list) {
    const d = lev(name.toLowerCase(), c.toLowerCase());
    if (d < bd) {
      bd = d;
      best = c;
    }
  }

  const limit = strict
    ? Math.max(1, Math.floor(name.length / 4))
    : Math.max(2, Math.floor(name.length / 3));

  return best !== null && bd <= limit ? best : null;
}

function makeCtx({
  props,
  aspect = '9:16',
  assetExists = () => true,
  aliases = {},
  allowMissingAssets = false,
}) {
  const errors = [];
  const warnings = [];
  const info = [];
  const missing = new Map();
  const missingAssets = [];

  const fmt = FORMATS[aspect] ?? FORMATS['9:16'];

  return {
    props,
    fmt,
    assetExists,
    aliases,
    errors,
    warnings,
    info,
    missing,
    missingAssets,
    allowMissingAssets,
    err: (m) => errors.push(m),
    warn: (m) => warnings.push(m),
  };
}

export function makeAssetExists(root, projectDir) {
  // Same order as backends/node.js makeAssetFinder (documented in STYLE.md):
  // project dir, project assets/, repo root, repo assets/.
  const dirs = [
    projectDir,
    path.join(projectDir, 'assets'),
    root,
    path.join(root, 'assets'),
  ];

  const fn = (p) =>
    /^(https?|data):/.test(p) ||
    dirs.some((d) => fs.existsSync(path.join(d, p)));

  fn.dirs = dirs.map((d) => path.relative(root, d) || '.');

  return fn;
}

function checkCue(v, label, field, ctx) {
  if (hasPh(v)) return;

  if (typeof v !== 'string' || !CUE_RE.test(v)) {
    ctx.err(
      `${label}: ${field} ${JSON.stringify(v)} is not a valid cue. Use "start", "end", "t:1.5", "word:kong" or "word:the#2", optionally followed by an offset like "+0.2s" or "-0.1s".`
    );
  }
}

function resolveProp(name, label, ctx) {
  const def = ctx.props[name];
  if (def) return def;

  const hint = closest(name, Object.keys(ctx.props), true);

  if (hint) {
    ctx.err(`${label}: unknown prop "${name}" — did you mean "${hint}"?`);
  } else {
    if (!ctx.missing.has(name)) ctx.missing.set(name, []);
    ctx.missing.get(name).push(label);
  }

  return null;
}

/** Validates slots + options of one layer/transition against meta. Returns text weight. */
function checkBody(body, def, label, ctx) {
  const slotSpecs = mapSpecs(def.meta?.slots);
  const optSpecs = mapSpecs(def.meta?.options);

  for (const bag of ['slots', 'options']) {
    if (body[bag] !== undefined && !isObj(body[bag])) {
      ctx.err(`${label}: "${bag}" must be an object`);
    }
  }

  const slots = isObj(body.slots) ? body.slots : {};
  const options = isObj(body.options) ? body.options : {};
  const pn = def.meta?.name ?? '?';

  for (const k of Object.keys(slots)) {
    if (k in slotSpecs) continue;

    if (k in optSpecs) {
      ctx.err(`${label}: "${k}" is an option of ${pn}, not a slot — move it into "options"`);
    } else {
      const h = closest(k, Object.keys(slotSpecs));

      ctx.err(
        `${label}: unknown slot "${k}" for ${pn}${h ? ` — did you mean "${h}"?` : ''} (slots: ${Object.keys(slotSpecs).join(', ') || 'none'})`
      );
    }
  }

  for (const k of Object.keys(options)) {
    if (k in optSpecs || UNIVERSAL_OPTIONS.includes(k)) continue;

    if (k in slotSpecs) {
      ctx.err(`${label}: "${k}" is a slot of ${pn}, not an option — move it into "slots"`);
    } else {
      const h = closest(k, Object.keys(optSpecs));

      ctx.warn(
        `${label}: ${pn} has no option "${k}"${h ? ` — did you mean "${h}"?` : ''} (it will be ignored)`
      );
    }
  }

  let weight = 0;

  const visit = (bagName, bag, specs) => {
    for (const [k, v] of Object.entries(bag)) {
      const s = specs[k];

      if (!s || hasPh(v)) continue;

      const bad = checkValue(s, v);

      if (bad) {
        ctx.err(`${label}: ${bagName}.${k}: ${bad}`);
        continue;
      }

      if (s.base === 'string' && typeof v === 'string') {
        weight += v.length;
      }

      if (s.base === 'asset' && typeof v === 'string') {
        const target =
          typeof ctx.aliases[v] === 'string'
            ? ctx.aliases[v]
            : v;

        if (!ctx.assetExists(target)) {
          const message =
            `${label}: ${bagName}.${k}: asset "${v}" not found` +
            `${ctx.assetExists.dirs
              ? ` (looked in ${ctx.assetExists.dirs.join(', ')})`
              : ''}`;

          if (ctx.allowMissingAssets) {
            ctx.missingAssets.push(message);
            ctx.warn(`${message} — draft placeholder expected`);
          } else {
            ctx.err(message);
          }
        }
      }
    }
  };

  visit('slots', slots, slotSpecs);
  visit('options', options, optSpecs);

  for (const [k, s] of Object.entries(slotSpecs)) {
    if (isRequired(s) && (slots[k] === undefined || slots[k] === null)) {
      ctx.err(`${label}: missing required slot "${k}" (${s.type})`);
    }
  }

  return weight;
}

const len = (v, base) => {
  if (typeof v === 'number') return v;

  const m = typeof v === 'string'
    ? /^(-?\d+(?:\.\d+)?)(%|px)?$/.exec(v.trim())
    : null;

  return m
    ? (m[2] === '%' ? (parseFloat(m[1]) * base) / 100 : parseFloat(m[1]))
    : NaN;
};

function lintSafeArea(layer, label, ctx) {
  const o = isObj(layer.options) ? layer.options : {};
  const { W, H, safe } = ctx.fmt;

  const x = len(o.x, W);
  const y = len(o.y, H);

  if (Number.isNaN(x) || Number.isNaN(y)) return;

  const w = len(o.w, W);
  const h = len(o.h, H);

  const hw = Number.isNaN(w) ? 0 : w / 2;
  const hh = Number.isNaN(h) ? 0 : h / 2;

  if (
    x - hw < safe.left - 1 ||
    x + hw > W - safe.right + 1 ||
    y - hh < safe.top - 1 ||
    y + hh > H - safe.bottom + 1
  ) {
    ctx.warn(
      `${label}: text layer extends outside the safe area (before camera movement). Safe box: x ${safe.left}–${W - safe.right}, y ${safe.top}–${H - safe.bottom}; the bottom band is for captions.`
    );
  }
}

/** Best-effort centre + size of a layer (px) from options/placement; null when unknown. */
function layerBoxPx(layer, def, fmt) {
  const o = isObj(layer.options) ? layer.options : {};
  const len = (v, base) => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const m = /^(-?\d+(?:\.\d+)?)(%|px)?$/.exec(v.trim());
      if (m) return m[2] === '%' ? (parseFloat(m[1]) * base) / 100 : parseFloat(m[1]);
    }
    return null;
  };
  // placement sugar implies a position even without explicit x/y
  let x = len(o.x, fmt.W), y = len(o.y, fmt.H);
  if ((x === null || y === null) && layer.place !== undefined) {
    const PLACE_Y = { center: 0.5, upper: 0.34, top: 0.22, lower: 0.66, bottom: 0.78 };
    if (typeof layer.place === 'string' && layer.place in PLACE_Y) {
      x = x ?? fmt.W / 2;
      y = y ?? PLACE_Y[layer.place] * fmt.H;
    } else if (isObj(layer.place)) {
      x = x ?? len(layer.place.x, fmt.W);
      y = y ?? len(layer.place.y, fmt.H);
    }
  }
  if (x === null || y === null) return null;
  const w = len(o.w, fmt.W), h = len(o.h, fmt.H);
  return { x, y, w: w ?? 0, h: h ?? 0, sized: w !== null && h !== null };
}

const boxesOverlap = (a, b) =>
  a.sized && b.sized &&
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;

/** Warn when two content layers occupy the same screen area (P0.2). */
function lintCollisions(shot, L, ctx) {
  const layers = (Array.isArray(shot.layers) ? shot.layers : []).filter(isObj);
  const boxes = [];
  layers.forEach((l, j) => {
    const def = ctx.props[l.prop];
    if (!def) return;
    const cat = def.meta?.category;
    if (cat === 'backgrounds' || cat === 'transitions') return;      // surfaces, not content
    if (typeof l.target === 'string') return;                        // locked onto a target: intended
    if (l.place === 'stack' || /^stack/.test(String(l.place))) return; // explicit stack: spaced by design
    const box = layerBoxPx(l, def, ctx.fmt);
    if (box) boxes.push({ j, prop: l.prop, box, label: `${L}.layers[${j}] (${l.prop})` });
  });
  for (let a = 0; a < boxes.length; a++) {
    for (let b = a + 1; b < boxes.length; b++) {
      if (boxesOverlap(boxes[a].box, boxes[b].box)) {
        ctx.warn(
          `${boxes[a].label} and ${boxes[b].label} overlap on screen — give them different y (or "place": "upper"/"lower"), or lock the annotation with "target": "<layer id>"`
        );
      }
    }
  }
}

/** Validates one layer. Returns { weight } or null. Exported for recipes. */
export function checkLayer(layer, label, ctx) {
  if (!isObj(layer)) {
    ctx.err(`${label}: layer must be an object`);
    return null;
  }

  for (const k of Object.keys(layer)) {
    if (LAYER_KEYS.includes(k)) continue;

    const h = closest(k, LAYER_KEYS);

    ctx.err(
      `${label}: unknown layer key "${k}"${h ? ` — did you mean "${h}"?` : ''} (slot/option values go inside "slots"/"options"; allowed: ${LAYER_KEYS.join(', ')})`
    );
  }

  for (const f of ['at', 'until']) {
    if (layer[f] !== undefined) checkCue(layer[f], label, f, ctx);
  }

  if (
    layer.depth !== undefined &&
    !hasPh(layer.depth) &&
    !(typeof layer.depth === 'number' && layer.depth >= 0 && layer.depth <= 1)
  ) {
    ctx.err(`${label}: depth must be a number from 0 (far) to 1 (near)`);
  }

  if (layer.z !== undefined && !hasPh(layer.z) && typeof layer.z !== 'number') {
    ctx.err(`${label}: z must be a number`);
  }

  if (
    layer.space !== undefined &&
    !hasPh(layer.space) &&
    !['world', 'screen'].includes(layer.space)
  ) {
    ctx.err(`${label}: space must be "world" or "screen"`);
  }

  // P0.2 placement sugar: "place" is resolved by the director into options.x/y
  if (layer.place !== undefined && !hasPh(layer.place)) {
    const p = layer.place;
    const ok = ['center', 'upper', 'top', 'lower', 'bottom', 'stack'].includes(p) ||
      /^stack(:\d+)?\/\d+$/.test(p) ||
      (isObj(p) && (p.x !== undefined || p.y !== undefined));
    if (!ok) {
      ctx.err(`${label}: place must be "center"|"upper"|"top"|"lower"|"bottom"|"stack"|"stack:N/M" or {x,y}`);
    }
  }

  if (typeof layer.prop !== 'string' || !layer.prop) {
    ctx.err(`${label}: "prop" is required`);
    return null;
  }

  const def = resolveProp(layer.prop, `${label} (${layer.prop})`, ctx);
  if (!def) return null;

  const weight = checkBody(layer, def, `${label} (${layer.prop})`, ctx);

  if (weight > 0) lintSafeArea(layer, `${label} (${layer.prop})`, ctx);

  return { weight };
}

/** Validate a recipe's shot snippet (placeholders allowed). */
export function validateRecipe(recipe, props) {
  const ctx = makeCtx({ props });

  (recipe.shot?.layers ?? []).forEach((l, i) => {
    checkLayer(l, `layers[${i}]`, ctx);
  });

  return {
    errors: ctx.errors,
    missing: [...ctx.missing.keys()],
  };
}

/** Problems with a prop's own meta (and its example). [] when healthy. */
export function checkPropMeta(def) {
  const m = def?.meta;
  const p = [];

  if (!m) return ['missing meta'];

  for (const k of ['name', 'use', 'avoid']) {
    if (typeof m[k] !== 'string' || !m[k].trim()) {
      p.push(`meta.${k} must be a non-empty string`);
    }
  }

  for (const k of ['slots', 'options']) {
    if (!isObj(m[k])) p.push(`meta.${k} must be an object`);
  }

  if (!(m.defaultDuration > 0)) p.push('meta.defaultDuration must be > 0');
  if (!isObj(m.example)) p.push('meta.example must be { slots, options }');
  if (typeof def.draw !== 'function') p.push('draw must be a function');

  if (p.length) return p;

  const slots = mapSpecs(m.slots);
  const opts = mapSpecs(m.options);

  for (const k of Object.keys(slots)) {
    if (k in opts) p.push(`"${k}" is both a slot and an option`);
  }

  for (const [k, s] of [...Object.entries(slots), ...Object.entries(opts)]) {
    if (s.base === 'unknown') p.push(`"${k}" has unknown type "${s.type}"`);
  }

  const ctx = makeCtx({ props: { [m.name]: def } });

  checkLayer(
    {
      prop: m.name,
      slots: m.example.slots ?? {},
      options: m.example.options ?? {},
    },
    'meta.example',
    ctx
  );

  return [...p, ...ctx.errors];
}

export function validateScript({
  script,
  props,
  aspect = '9:16',
  assetExists = () => true,
  allowMissingAssets = false,
}) {
  const ctx = makeCtx({
    props,
    aspect,
    assetExists,
    aliases: isObj(script?.assets) ? script.assets : {},
    allowMissingAssets,
  });

  const done = () => ({
    errors: ctx.errors,
    warnings: ctx.warnings,
    info: ctx.info,
    missingProps: [...ctx.missing].map(([name, uses]) => ({ name, uses })),
    missingAssets: ctx.missingAssets,
  });

  if (!isObj(script)) {
    ctx.err('script.json must be a JSON object');
    return done();
  }

  const ph = JSON.stringify(script).match(/\{\{[^}]+\}\}/g);

  if (ph) {
    ctx.err(`unfilled placeholder(s): ${[...new Set(ph)].slice(0, 5).join(', ')}`);
  }

  if (!Array.isArray(script.lines) || !script.lines.length) {
    ctx.err('"lines" must be a non-empty array');
  }

  const ids = new Set();

  (Array.isArray(script.lines) ? script.lines : []).forEach((ln, i) => {
    const L = `lines[${i}]`;

    if (!isObj(ln)) return ctx.err(`${L}: must be an object`);

    if (typeof ln.id !== 'string' || !ln.id) {
      ctx.err(`${L}: "id" is required`);
    } else if (ids.has(ln.id)) {
      ctx.err(`${L}: duplicate line id "${ln.id}"`);
    } else {
      ids.add(ln.id);
    }

    if (typeof ln.text !== 'string' || !ln.text.trim()) {
      ctx.err(`${L}: "text" must be a non-empty string`);
    }

    if (ln.say !== undefined && typeof ln.say !== 'string') {
      ctx.err(`${L}: "say" must be a string`);
    }

    if (ln.caps !== undefined && ln.caps !== false && typeof ln.caps !== 'string') {
      ctx.err(`${L}: "caps" must be a string or false`);
    }

    if (typeof ln.caps === 'string') {
      if ((ln.caps.match(/\*/g) || []).length % 2) {
        ctx.err(`${L}: caps has an unbalanced "*"`);
      }

      for (const c of ln.caps.split('|')) {
        const n = c.replace(/\*/g, '').trim().split(/\s+/).filter(Boolean).length;

        if (n > 8) {
          ctx.warn(`${L}: caption chunk "${c.trim().slice(0, 30)}…" has ${n} words; split with "|" (aim for ≤ 6)`);
        }
      }
    }
  });

  if (!Array.isArray(script.shots) || !script.shots.length) {
    ctx.err('"shots" must be a non-empty array');
  }

  (Array.isArray(script.shots) ? script.shots : []).forEach((s, i) => {
    const L = `shots[${i}]`;

    if (!isObj(s)) return ctx.err(`${L}: must be an object`);

    if (s.span !== undefined) {
      if (!Array.isArray(s.span) || s.span.length !== 2) {
        ctx.err(`${L}: span must be [fromCue, toCue]`);
      } else {
        s.span.forEach((c, j) => checkCue(c, L, `span[${j}]`, ctx));
      }
    }

    if (s.camera !== undefined) {
      const mv = typeof s.camera === 'string'
        ? s.camera
        : isObj(s.camera)
          ? s.camera.move ?? s.camera.type
          : null;

      if (mv === null) {
        ctx.err(`${L}: camera must be a move name or an object`);
      } else if (mv !== undefined && !hasPh(mv) && !CAMERA_MOVES.includes(mv)) {
        ctx.err(`${L}: unknown camera move "${mv}" (${CAMERA_MOVES.join(', ')})`);
      }
    }

    if (s.layers !== undefined && !Array.isArray(s.layers)) {
      ctx.err(`${L}: "layers" must be an array`);
    }

    let heavy = 0;

    (Array.isArray(s.layers) ? s.layers : []).forEach((l, j) => {
      const r = checkLayer(l, `${L}.layers[${j}]`, ctx);
      if (r && r.weight >= TEXT_HEAVY) heavy++;
    });

    if (heavy > TEXT_HEAVY_MAX) {
      ctx.warn(`${L}: ${heavy} text-heavy layers (max ${TEXT_HEAVY_MAX} at once) — give them "until" so they don't overlap`);
    }

    // P0.2 collision detection: two content layers with explicit/placed geometry that
    // overlap on screen. Annotations (which deliberately sit ON things) are exempt.
    lintCollisions(s, L, ctx);

    // sfx must be an array of typed objects (M5 fix: a bare string used to pass validate
    // and then throw "sfx.forEach is not a function" deep inside the director dry-run).
    if (s.sfx !== undefined) {
      if (!Array.isArray(s.sfx)) {
        ctx.err(`${L}: "sfx" must be an array of { "type", "at", "gain" } objects — got ${JSON.stringify(s.sfx).slice(0, 40)}`);
      } else {
        s.sfx.forEach((x, k) => {
          const SL = `${L}.sfx[${k}]`;
          if (!isObj(x)) {
            ctx.err(`${SL}: must be an object like { "type": "pop", "at": "word:flag", "gain": 0.8 } — a bare string is not accepted`);
            return;
          }
          if (typeof x.type !== 'string' || !x.type) {
            ctx.err(`${SL}: "type" is required (${SFX_TYPES.join(', ')})`);
          } else if (!SFX_TYPES.includes(x.type)) {
            ctx.err(`${SL}: unknown sfx type "${x.type}" (${SFX_TYPES.join(', ')})`);
          }
          if (x.at !== undefined) checkCue(x.at, SL, 'at', ctx);
          if (x.gain !== undefined && !(typeof x.gain === 'number' && Number.isFinite(x.gain) && x.gain >= 0)) {
            ctx.err(`${SL}: gain must be a number >= 0`);
          }
        });
      }
    }

    // "target" locks an annotation onto another layer's box (bounds registry, PR1):
    // it must name an EARLIER layer's explicit "id" in this same shot.
    (Array.isArray(s.layers) ? s.layers : []).forEach((l, j) => {
      if (!isObj(l) || typeof l.target !== 'string' || !l.target) return;
      const layers = Array.isArray(s.layers) ? s.layers : [];
      const earlier = layers.slice(0, j).some((x) => isObj(x) && x.id === l.target);
      if (!earlier) {
        const later = layers.some((x) => isObj(x) && x.id === l.target);
        ctx.err(
          `${L}.layers[${j}]: "target" must name an earlier layer's "id" in this same shot` +
          (later ? ` — "${l.target}" exists but comes after this annotation; move it above` : ` (no layer with id "${l.target}" here)`)
        );
      }
      const pad = isObj(l.options) ? l.options.pad : undefined;
      if (pad !== undefined && pad !== null &&
          !(typeof pad === 'number' && Number.isFinite(pad)) &&
          !(typeof pad === 'string' && /^-?\d+(?:\.\d+)?%$/.test(pad.trim()))) {
        ctx.err(`${L}.layers[${j}]: options.pad must be a number (px) or an "N%" string`);
      }
    });

    if (s.transition !== undefined) {
      const t = s.transition;
      const TL = `${L}.transition`;

      if (!isObj(t) || typeof t.type !== 'string') {
        ctx.err(`${TL}: needs { "type": "<transition prop>" }`);
      } else {
        if (t.duration !== undefined && !(typeof t.duration === 'number' && t.duration > 0)) {
          ctx.err(`${TL}: duration must be a number > 0`);
        }

        const def = resolveProp(t.type, `${TL} (${t.type})`, ctx);

        if (def) {
          if (def.meta?.category && def.meta.category !== 'transitions') {
            ctx.warn(`${TL}: "${t.type}" is not in the transitions category`);
          }

          checkBody(t, def, `${TL} (${t.type})`, ctx);
        }
      }
    }
  });

  return done();
}

/** Events = shot starts + layer starts. Returns null if the timeline shape isn't recognised. */
export function timelineEvents(tl) {
  const pick = (o, ...ks) => {
    for (const k of ks) {
      if (typeof o?.[k] === 'number') return o[k];
    }
  };

  if (!Array.isArray(tl?.shots) || !tl.shots.length) return null;

  const ev = [];
  let sawLayers = false;
  let sawTimes = false;

  for (const s of tl.shots) {
    const a = pick(s, 'start', 't0', 'from');
    if (a === undefined) return null;

    ev.push(a);

    for (const l of s.layers ?? []) {
      sawLayers = true;

      const t = pick(l, 'start', 't0', 'from');

      if (t !== undefined) {
        sawTimes = true;
        ev.push(t);
      }
    }
  }

  if (sawLayers && !sawTimes) return null;

  const end =
    pick(tl, 'end', 'duration', 'total') ??
    pick(tl.shots.at(-1), 'end', 't1', 'to');

  return {
    events: [...new Set(ev)].sort((a, b) => a - b),
    end,
  };
}

export function lintTimeline(tl) {
  const r = timelineEvents(tl);

  if (!r) {
    return {
      warnings: [],
      note: 'pacing lint skipped (timeline shape not recognised)',
    };
  }

  const warnings = [];
  const pts = r.end === undefined ? r.events : [...r.events, r.end];

  for (let i = 1; i < pts.length; i++) {
    if (pts[i] - pts[i - 1] > MAX_QUIET) {
      warnings.push(
        `no new visual or cue for ${(pts[i] - pts[i - 1]).toFixed(1)}s (${pts[i - 1].toFixed(1)}s → ${pts[i].toFixed(1)}s)`
      );
    }
  }

  return { warnings, note: null };
}

async function dryRun({ root, project, aspect, defs }) {
  const { loadProject } = await import(
    pathToFileURL(path.join(root, 'core/project.js')).href
  );

  const projectDir = path.join(root, 'projects', project);
  let props = defs;

  for (const f of [
    path.join(projectDir, 'registry.generated.js'),
    path.join(root, 'props/registry.generated.js'),
  ]) {
    if (!fs.existsSync(f)) continue;

    try {
      const m = await import(pathToFileURL(f).href + `?t=${Date.now()}`);
      const r = m.default ?? m.props ?? m.registry ?? m;

      props = Array.isArray(r)
        ? r
        : Object.fromEntries(
            Object.entries(r).map(([k, v]) => [
              k,
              v?.default?.meta ? v.default : v,
            ])
          );

      break;
    } catch {
      // Fall back to discovered defs.
    }
  }

  const find = (p) =>
    [
      path.isAbsolute(p) ? p : null,
      path.join(projectDir, p),
      path.join(root, p),
      path.join(projectDir, 'assets', p),
    ]
      .filter(Boolean)
      .find((c) => fs.existsSync(c) && fs.statSync(c).isFile());

  const noFile = (p) =>
    Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' });

  return loadProject({
    readJSON: async (p, opts = {}) => {
      const f = find(p);
      if (!f) {
        if (opts.optional) return null;
        throw noFile(p);
      }
      return JSON.parse(fs.readFileSync(f, 'utf8'));
    },
    loadImage: async (p) => {
      if (!find(p)) throw noFile(p);
      return { width: 100, height: 100 };
    },
    createCanvas: (w, h) => ({
      width: w,
      height: h,
      getContext: () => null,
    }),
    resolvePath: (p) => find(p) ?? p,
    props,
    aspect,
    strict: true,
  });
}

export async function validateProject({
  project,
  aspect = null,
  dry = true,
  root = ROOT,
  draft = false,
}) {
  let scanNote = null;

  try {
    execFileSync(
      process.execPath,
      [path.join(root, 'tools/scan-props.mjs')],
      { cwd: root, stdio: 'pipe' }
    );
  } catch (e) {
    scanNote = `prop scan failed: ${String(e.stderr || e.message).split('\n')[0]}`;
  }

  const { props, problems } = await discoverProps({ root, project });
  const defs = toDefs(props);

  const projectDir = path.join(root, 'projects', project);
  const file = path.join(projectDir, 'script.json');

  const empty = {
    errors: [],
    warnings: [],
    info: [],
    missingProps: [],
    missingAssets: [],
  };

  if (!fs.existsSync(file)) {
    return {
      ...empty,
      errors: [`projects/${project}/script.json not found`],
    };
  }

  let script;

  try {
    script = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return {
      ...empty,
      errors: [`script.json is not valid JSON: ${e.message}`],
    };
  }

  // C2 fix: an explicit --aspect wins, otherwise the script's own meta.aspect is honoured
  // (previously every caller defaulted the flag to 9:16, so meta.aspect could never win).
  const asp = aspect || script?.meta?.aspect || '9:16';

  const res = validateScript({
    script,
    props: defs,
    aspect: asp,
    assetExists: makeAssetExists(root, projectDir),
    allowMissingAssets: draft,
  });

  res.aspect = asp;

  res.warnings.unshift(
    ...problems.map((p) => `prop registry: ${p}`),
    ...(scanNote ? [scanNote] : [])
  );

  if (!dry) return res;

  if (res.errors.length || res.missingProps.length) {
    res.info.push('director dry-run skipped (fix the items above first)');
    return res;
  }

  // In draft mode, missing images are allowed through validation.
  // Skip the strict director dry-run only when those images are missing.
  // The actual renderer handles the existing draft placeholders.
  if (draft && res.missingAssets.length) {
    res.info.push(
      `director dry-run skipped in draft mode (${res.missingAssets.length} missing asset(s))`
    );
    return res;
  }

  try {
    const r = await dryRun({ root, project, aspect: asp, defs });

    if (r.estimated) {
      res.info.push(
        'timing is estimated (no words.json yet); word cues resolve against the script text'
      );
    }

    const lint = lintTimeline(r.timeline);

    res.warnings.push(...lint.warnings);

    if (lint.note) res.info.push(lint.note);
  } catch (e) {
    res.errors.push(
      `director dry-run failed: ${e.message} (if this looks like a harness problem rather than your script, report it)`
    );
  }

  return res;
}

function print(project, aspect, res) {
  const out = [`validate ${project} (${aspect})`];

  const sect = (icon, title, items) => {
    if (items.length) {
      out.push(
        `\n${icon} ${items.length} ${title}`,
        ...items.map((m) => `  - ${m}`)
      );
    }
  };

  sect('✖', 'error(s)', res.errors);

  if (res.missingProps.length) {
    out.push('\nMISSING PROPS (ask for these to be built, or pick another prop)');

    for (const m of res.missingProps) {
      out.push(
        `  - ${m.name}: used ${m.uses.length}x at ${m.uses.join('; ')}`
      );
    }
  }

  sect('⚠', 'warning(s)', res.warnings);

  if (res.info.length) {
    out.push('', ...res.info.map((m) => `ℹ ${m}`));
  }

  if (!res.errors.length && !res.missingProps.length) {
    out.push('\n✔ script is valid');
  }

  console.log(out.join('\n'));
}

async function main() {
  // M3 fix: parseArgs instead of hand-rolled scanning — "npm run validate -- p --aspect 16:9"
  // used to pick "16:9" as the project name because it does not start with "--".
  const { values: flags, positionals: [project] } = parseArgs({
    allowPositionals: true,
    options: {
      aspect: { type: 'string' },
      json: { type: 'boolean' },
      'no-dry-run': { type: 'boolean' },
      draft: { type: 'boolean' },
    },
  });

  if (!project) {
    console.error(
      'usage: npm run validate -- <project> [--aspect ' + FORMAT_LIST + '] [--json] [--no-dry-run] [--draft]'
    );
    process.exit(2);
  }

  const res = await validateProject({
    project,
    aspect: flags.aspect,
    dry: !flags['no-dry-run'],
    draft: flags.draft === true,
  });

  if (flags.json) {
    console.log(JSON.stringify(res, null, 2));
  } else {
    print(project, res.aspect, res);
  }

  process.exit(res.errors.length || res.missingProps.length ? 1 : 0);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  main();
}
