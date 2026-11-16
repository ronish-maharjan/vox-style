// props/_shared/doc.js — shared by the page props: sheet size per aspect, paper sheet, word layout and fitting. Import as vox-studio/kit/doc.js
import { paint, num, font, rngFor, toRGB } from './look.js';
import { tornPath } from './shapes.js';
import { dropShadow } from 'vox-studio/core/helpers.js';
import { frame, fit } from './frame.js';

/** CSS rgba() string for a theme colour name. */
export function rgba(theme, name, al) {
  const c = Array.from(toRGB(paint(theme, name)));
  return `rgba(${c[0]},${c[1]},${c[2]},${al})`;
}

/** Sheet size: portrait ratio in 9:16, memo ratio in 16:9, always inside the safe box. o.w / o.h override. */
export function sheetBox(env, o, ratioP = 0.76, ratioL = 1.2) {
  const F = frame(env), r = F.portrait ? ratioP : ratioL, b = fit(r, F.w * 0.96, F.h * 0.98);
  const w = num(o.w, b.w), h = num(o.h, o.w ? w / r : b.h);
  return { w, h };
}

/** Paper sheet centred on the origin: shadow, lightly cut edge, optional aging and fold creases. */
export function drawSheet(ctx, env, w, h, { tone = 'white', aged = false, folds = 0 } = {}) {
  const { theme } = env;
  dropShadow(ctx, theme, () => { ctx.fillStyle = paint(theme, tone); tornPath(ctx, w, h, rngFor(env, 'tear'), 1.8, 40); ctx.fill(); }, {});
  ctx.save();
  ctx.beginPath(); ctx.rect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6); ctx.clip();
  if (aged) {
    const rng = rngFor(env, 'age'), g = ctx.createRadialGradient(0, 0, Math.min(w, h) * 0.3, 0, 0, Math.max(w, h) * 0.8);
    g.addColorStop(0, rgba(theme, 'kraft', 0)); g.addColorStop(1, rgba(theme, 'kraft', 0.4));
    ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h);
    for (let i = 0; i < 4; i++) {
      const sx = rng.range(-w / 2, w / 2), sy = rng.range(-h / 2, h / 2), sr = rng.range(w * 0.08, w * 0.2);
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
      sg.addColorStop(0, rgba(theme, 'kraft', 0.18)); sg.addColorStop(1, rgba(theme, 'kraft', 0));
      ctx.fillStyle = sg; ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
    }
  }
  for (let k = 1; k <= folds; k++) {
    const fy = -h / 2 + (h * k) / (folds + 1), g = ctx.createLinearGradient(0, fy - 14, 0, fy + 14);
    g.addColorStop(0, rgba(theme, 'ink', 0)); g.addColorStop(0.5, rgba(theme, 'ink', 0.08)); g.addColorStop(1, rgba(theme, 'ink', 0));
    ctx.fillStyle = g; ctx.fillRect(-w / 2, fy - 14, w, 28);
    ctx.fillStyle = rgba(theme, 'white', 0.5); ctx.fillRect(-w / 2, fy + 1, w, 1.5);
  }
  ctx.restore();
}

/** Split text into word tokens; a newline becomes a { br: true } token. */
export function tokens(text) {
  const out = [];
  String(text ?? '').split('\n').forEach((para, i) => {
    if (i) out.push({ br: true });
    para.split(/\s+/).filter(Boolean).forEach((t) => out.push({ t }));
  });
  return out;
}

/** Wrap tokens at maxW with the current ctx.font. Returns lines of { ...token, x, w } (x relative to the line start). */
export function layoutWords(ctx, toks, maxW) {
  const sp = ctx.measureText(' ').width, lines = [[]];
  let x = 0;
  for (const k of toks) {
    if (k.br) { lines.push([]); x = 0; continue; }
    const w = ctx.measureText(k.t).width;
    if (lines[lines.length - 1].length && x + sp + w > maxW) { lines.push([]); x = 0; }
    const ln = lines[lines.length - 1];
    if (ln.length) x += sp;
    ln.push({ ...k, x, w });
    x += w;
  }
  return lines;
}

/** Largest font size in [minS, maxS] whose wrapped lines fit maxH; lines beyond the box are dropped. Leaves ctx.font set. */
export function fitText(ctx, theme, kind, weight, toks, maxW, maxH, maxS, minS, lhk = 1.5) {
  let s = Math.round(maxS), lines;
  for (;;) {
    ctx.font = font(theme, kind, s, weight);
    lines = layoutWords(ctx, toks, maxW);
    if (lines.length * s * lhk <= maxH || s <= minS) break;
    s -= 2;
  }
  const cap = Math.max(1, Math.floor(maxH / (s * lhk)));
  return { size: s, lh: s * lhk, lines: lines.slice(0, cap) };
}
