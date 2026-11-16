// core/renderer.js — render(ctx, T). Order: paper -> world layers (camera+depth) -> screen layers -> grain -> transitions -> captions.
// Usage: const r = createRenderer({ script, timeline, theme, assets, props, createCanvas, strict }); r.render(ctx, 1.25)
import { clamp, seg, ease } from './easing.js';
import { cameraState, applyCamera } from './camera.js';
import { resolveGeometry, seededRandom, sprite } from './helpers.js';
import { shotAt } from './director.js';
import { drawCaptions } from './captions.js';

export function createRenderer({ script, timeline, theme, assets, props, createCanvas, strict = false }) {
  const { W, H, orientation, safe } = theme.format;
  const sprites = new Map(), warned = new Set(), last = timeline.shots.length - 1;
  const baseEnv = { W, H, orientation, safe, theme, assets, createCanvas, sprites };
  const mkEnv = (id, t, p, words) => ({ ...baseEnv, id, t, p, words, rng: (label = '') => seededRandom(`${id}|${label}`) });
  // Bounds registry (PR1): layer id -> the box it occupied on the CURRENT frame.
  // A later layer with "target": "<id>" inherits that box (plus space and depth), so
  // annotations lock onto their targets and stay locked under camera moves.
  const bounds = new Map();
  const padOf = (pad, b) => {
    if (typeof pad === 'number' && Number.isFinite(pad)) return Math.max(0, pad);
    if (typeof pad === 'string') {
      const m = /^(-?\d+(?:\.\d+)?)%$/.exec(pad.trim());
      if (m) return Math.max(0, (parseFloat(m[1]) / 100) * (b.w || 0));
    }
    return 0;
  };

  function animOf(L, prop, T) {
    const enter = L.enter ?? prop.meta.enter ?? theme.motion.enter, exit = L.exit ?? theme.motion.exit;
    return {
      appear: ease(prop.meta.enterEase || 'easeOut', seg(T, L.start, L.start + enter)),
      exit: L.explicitEnd ? seg(T, L.end - exit, L.end) : 0,      // layers that last to the shot end are cut, not faded
    };
  }

  function callProp(ctx, prop, id, o, env, space, cam, depth, errors) {
    const m = ctx.getTransform();
    let err = null;
    ctx.save();
    try {
      if (space === 'world') applyCamera(ctx, cam, depth);
      ctx.globalAlpha = clamp(o.opacity ?? 1);
      prop.draw(ctx, o, env);
    } catch (e) { err = e; }
    ctx.restore();
    if (!err) return;
    if (strict) throw new Error(`[${id}] ${prop.meta.name}: ${err.message}`, { cause: err });
    ctx.setTransform(m); ctx.globalAlpha = 1;
    errors.push(`${id}: ${err.message}`);
    if (!warned.has(id + err.message)) { warned.add(id + err.message); console.warn(`[${id}]`, err); }
  }

  function drawGrain(ctx, T) {
    const S = 256, tile = sprite(baseEnv, 'grain', S, S, (g, w, h) => {
      const img = g.createImageData(w, h), r = seededRandom('grain');
      for (let i = 0; i < w * h; i++) {
        const v = r() < 0.5 ? 0 : 255;
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
        img.data[i * 4 + 3] = Math.floor(r() * 255);
      }
      g.putImageData(img, 0, 0);
    });
    const j = seededRandom(`grain-offset-${Math.floor(T * 12)}`), ox = -Math.floor(j() * S), oy = -Math.floor(j() * S);
    ctx.save();
    ctx.globalAlpha = theme.grain.opacity;
    for (let x = ox; x < W; x += S) for (let y = oy; y < H; y += S) ctx.drawImage(tile, x, y);
    ctx.restore();
  }

  function drawErrors(ctx, errors) {
    ctx.save(); ctx.font = '600 26px sans-serif'; ctx.textBaseline = 'top';
    errors.slice(0, 4).forEach((m, i) => {
      const y = 20 + i * 44;
      ctx.fillStyle = 'rgba(232,69,44,0.95)'; ctx.fillRect(20, y, W - 40, 38);
      ctx.fillStyle = '#fff'; ctx.fillText(m, 32, y + 6, W - 64);
    });
    ctx.restore();
  }

  function render(ctx, T) {
    T = clamp(T, 0, timeline.duration);
    const shot = shotAt(timeline, T), tl = T - shot.start, p = clamp(tl / shot.duration), errors = [];
    const cam = cameraState(shot.camera, { p, t: tl, W, H, orientation, seed: shot.index + 1 });
    ctx.save();
    ctx.fillStyle = theme.colors.paper; ctx.fillRect(0, 0, W, H);

    const eps = shot.index === last ? 1e-6 : 0;
    const active = shot.layers.filter((L) => T >= L.start && T < L.end + eps).sort((a, b) => a.z - b.z || a.order - b.order);
    // PR1 pre-pass: register every active layer's declared box (pure geometry, no drawing),
    // so a "target" lookup works no matter which space pass the annotation itself draws in.
    // P0.2: a layer with a resolved "place" (director filled options.x/y) but no w/h still
    // registers a POINT box when the prop declares a default size, so annotations can lock
    // onto placed layers without the script giving explicit pixel geometry.
    bounds.clear();
    for (const L of active) {
      if (!props[L.prop] || typeof L.target === 'string') continue; // annotations register their own box only if declared
      const g = resolveGeometry({ ...L.slots, ...L.options }, mkEnv(L.id, tl, p, shot.localWords));
      if ([g.x, g.y].every(Number.isFinite)) {
        const sized = [g.w, g.h].every(Number.isFinite);
        const def = props[L.prop] && props[L.prop].defaultSize;
        const w = sized ? g.w : def ? def.w : 0, h = sized ? g.h : def ? def.h : 0;
        bounds.set(L.id, { x: g.x, y: g.y, w, h, space: L.space, depth: L.depth, ...(sized || def ? {} : { point: true }) });
      }
    }
    for (const space of ['world', 'screen']) {
      for (const L of active) {
        if (L.space !== space) continue;
        const prop = props[L.prop];
        if (!prop) { if (strict) throw new Error(`unknown prop "${L.prop}"`); errors.push(`unknown prop ${L.prop}`); continue; }
        const env = mkEnv(L.id, tl, p, shot.localWords), o = { ...resolveGeometry({ ...L.slots, ...L.options }, env), ...animOf(L, prop, T) };
        // "target": "<layer id>" locks this layer onto an earlier layer's box (PR1).
        // The annotation inherits x/y/w/h (plus optional "pad"), space and depth, so it
        // travels with the target under camera moves instead of guessing pixel geometry.
        let drawSpace = space, depth = L.depth;
        if (L.target) {
          const b = bounds.get(L.target);
          if (b) {
            const pad = padOf(o.pad, b);
            o.x = b.x - pad; o.y = b.y - pad; o.w = b.w + pad * 2; o.h = b.h + pad * 2;
            drawSpace = b.space; depth = b.depth;
          } else {
            const msg = `[${L.id}] target "${L.target}" has no box — give the target layer an "id" and explicit x/y/w/h`;
            if (strict) throw new Error(msg);
            errors.push(msg);
          }
        }
        callProp(ctx, prop, L.id, o, env, drawSpace, cam, depth, errors);
      }
    }
    if (script.meta?.grain !== false) drawGrain(ctx, T);
    for (const tr of timeline.transitions) {
      if (T < tr.start || T > tr.end) continue;
      const prop = props[tr.prop];
      if (!prop) continue;
      const pr = (T - tr.start) / (tr.end - tr.start), env = mkEnv(tr.id, T - tr.start, pr, shot.localWords);
      const o = { ...resolveGeometry({ ...tr.slots, ...tr.options }, env), progress: pr, appear: pr, exit: 0 };
      callProp(ctx, prop, tr.id, o, env, 'screen', cam, 0, errors);
    }
    if (script.meta?.captions !== false) drawCaptions(ctx, timeline.captions, T, { theme });
    if (errors.length) drawErrors(ctx, errors);
    ctx.restore();
  }

  return { W, H, duration: timeline.duration, theme, render, shotAt: (T) => shotAt(timeline, T), bounds: () => Object.fromEntries(bounds) };
}
