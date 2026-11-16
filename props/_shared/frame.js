// props/_shared/frame.js — frame geometry so props adapt to 9:16 and 16:9: safe box, portrait flag, base unit u. Import as vox-studio/kit/frame.js
import { margins } from './look.js';

/** Safe box of the current frame: x,y,w,h, centre, portrait flag and u = the shorter side. */
export function frame(env) {
  const m = margins(env), x = m.left, y = m.top, w = env.W - m.left - m.right, h = env.H - m.top - m.bottom;
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2, portrait: env.H >= env.W, u: Math.min(w, h) };
}

/** Largest w x h with aspect r (w/h) that fits inside fw x fh. */
export function fit(r, fw, fh) {
  const w = Math.min(fw, fh * r);
  return { w, h: w / r };
}
