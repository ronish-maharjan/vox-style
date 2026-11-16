// props/_shared/shapes.js — hand-made-looking shape + text helpers shared by props.
// Usage: import { tornPath, wrapText, highlightBar, fitFont, outCubic, inOutCubic, backOut, fmtNum } from 'vox-studio/kit/shapes.js';
import { font } from './look.js';

const c01 = (t) => Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
export const outCubic = (t) => 1 - (1 - c01(t)) ** 3;
export const inOutCubic = (t) => { const u = c01(t); return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2; };
/** Ease-out with overshoot. Only stamps and pins may use it. */
export const backOut = (t, k = 1.7) => { const u = c01(t) - 1; return 1 + (k + 1) * u * u * u + k * u * u; };

/** 1234.5 -> "1,234.5" */
export function fmtNum(v, dec) {
  const d = dec ?? (Number.isInteger(v) ? 0 : 1);
  const [i, f] = Math.abs(v).toFixed(d).split('.');
  return `${v < 0 ? '-' : ''}${i.replace(/\B(?=(\d{3})+$)/g, ',')}${f ? `.${f}` : ''}`;
}

/** Shrink font until text fits maxW. Leaves ctx.font set; returns the size. */
export function fitFont(ctx, theme, kind, text, size, weight, maxW, min = 16) {
  let s = size;
  ctx.font = font(theme, kind, s, weight);
  while (s > min && ctx.measureText(String(text)).width > maxW) { s -= 2; ctx.font = font(theme, kind, s, weight); }
  return s;
}

/** Wrap text to maxW (ctx.font must be set). Truncates with an ellipsis past maxLines. */
export function wrapText(ctx, text, maxW, maxLines = 99) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean), lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\s*\S*$/, '')}…`; }
  return lines;
}

/** Closed, slightly torn rectangle path centred on the origin. Same rng seed => same shape. */
export function tornPath(ctx, w, h, rng, amp = 5, step = 26) {
  const hw = w / 2, hh = h / 2, pts = [];
  const edge = (x0, y0, x1, y1) => {
    const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let i = 0; i < n; i++) {
      const s = i / n;
      pts.push([x0 + (x1 - x0) * s + rng.range(-amp, amp), y0 + (y1 - y0) * s + rng.range(-amp, amp)]);
    }
  };
  edge(-hw, -hh, hw, -hh); edge(hw, -hh, hw, hh); edge(hw, hh, -hw, hh); edge(-hw, hh, -hw, -hh);
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

/** Highlighter swipe centred on the origin, drawn left→right up to progress p (0..1). */
export function highlightBar(ctx, w, h, p, rng, color) {
  const N = Math.max(2, Math.round(w / 28)), jt = [], jb = [];
  for (let i = 0; i <= N; i++) { jt.push(rng.range(-2.5, 2.5)); jb.push(rng.range(-2.5, 2.5)); } // always consume rng
  const prog = Math.min(1, Math.max(0, p));
  if (prog <= 0.001) return;
  const x0 = -w / 2, xe = x0 + w * prog, top = [], bot = [];
  for (let i = 0; i <= N; i++) {
    const px = x0 + (w * i) / N;
    if (px > xe) break;
    top.push([px, -h / 2 + jt[i]]); bot.push([px, h / 2 + jb[i]]);
  }
  const k = Math.min(N, top.length);
  top.push([xe, -h / 2 + jt[k]]); bot.push([xe, h / 2 + jb[k]]);
  top[0][0] += 5;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha *= 0.92;
  ctx.fillStyle = color;
  ctx.beginPath();
  top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
