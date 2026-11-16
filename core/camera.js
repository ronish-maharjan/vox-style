// core/camera.js — per-shot camera with depth parallax. Usage:
//   const st = cameraState(shot.camera, { p, t, W, H, orientation, seed });
//   ctx.save(); applyCamera(ctx, st, layer.depth ?? 0.5); ...draw layer...; ctx.restore();
// depth 0 = far (moves little), 1 = near (moves a lot). Edge cover is guaranteed for every depth.
import { clamp, lerp, ease, noise } from './easing.js';
import { resolveLen } from './helpers.js';
import { CAMERA_MOVES } from './constants.js';

export const MOVES = CAMERA_MOVES;

export function cameraState(spec = {}, { p, t = 0, W, H, orientation = 'portrait', seed = 0 }) {
  const move = spec.move || 'push-in';
  if (!MOVES.includes(move)) throw new Error(`camera.move "${move}" unknown. Use one of: ${MOVES.join(', ')}`);
  const e = ease(spec.ease || 'easeInOut', clamp(p));
  const st = { zoom: 1, panX: 0, panY: 0, rot: 0, shakeX: 0, shakeY: 0, fx: W / 2, fy: H / 2, cover: 1 };
  const zoomMove = move === 'push-in' || move === 'pull-out';
  const amount = spec.amount ?? (zoomMove ? 1.08 : move === 'tilt' ? 2 : move === 'shake' ? 14 : 0.06);

  if (zoomMove && spec.focus) {                       // focus only for zooms: pans need a centred pivot to stay covered
    st.fx = resolveLen(spec.focus.x ?? '50%', W, orientation);
    st.fy = resolveLen(spec.focus.y ?? '50%', H, orientation);
  }
  switch (move) {
    case 'push-in': st.zoom = lerp(1, amount, e); break;
    case 'pull-out': st.zoom = lerp(amount, 1, e); break;
    case 'pan-left': case 'pan-right': {              // content slides in the named direction
      const s = move === 'pan-left' ? 1 : -1;
      st.zoom = 1 + amount; st.panX = s * lerp(1, -1, e) * (amount * W) / 2; break;
    }
    case 'pan-up': case 'pan-down': {
      const s = move === 'pan-up' ? 1 : -1;
      st.zoom = 1 + amount; st.panY = s * lerp(1, -1, e) * (amount * H) / 2; break;
    }
    case 'drift': {
      const sx = noise(seed, 3) < 0 ? -1 : 1, sy = noise(seed, 9) < 0 ? -1 : 1;
      st.zoom = 1 + amount;
      st.panX = sx * lerp(-1, 1, e) * (amount * W) / 2 * 0.9;
      st.panY = sy * lerp(-1, 1, e) * (amount * H) / 2 * 0.9; break;
    }
    case 'tilt': {
      const a = (amount * Math.PI) / 180, ratio = Math.max(W / H, H / W);
      st.rot = lerp(-a, a, e);
      st.cover = Math.cos(a) + Math.sin(a) * ratio + 0.002; st.zoom = st.cover; break;
    }
    case 'shake': {
      st.shakeX = noise(t * 18, seed) * amount; st.shakeY = noise(t * 18, seed + 7) * amount;
      st.zoom = (1 + (2 * amount) / Math.min(W, H)) * lerp(1, 1.03, e); break;
    }
    case 'hold': st.zoom = lerp(1, 1.02, e); break;       // "never static"
  }
  return st;
}

export function applyCamera(ctx, st, depth = 0.5) {
  const k = 0.4 + clamp(depth) * 1.2;                   // depth 0.5 -> 1.0
  const s = Math.max(1 + (st.zoom - 1) * k, st.cover);
  ctx.translate(st.fx, st.fy);
  ctx.translate((st.panX + st.shakeX) * k, (st.panY + st.shakeY) * k);
  ctx.rotate(st.rot);
  ctx.scale(s, s);
  ctx.translate(-st.fx, -st.fy);
}
