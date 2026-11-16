// props/annotations/callout/index.js — paper label with a hand-drawn leader line ending in a ring on the target. Usage: { "prop":"callout", "slots":{ "text":"Last flag lowered" }, "options":{ "x":"30%", "y":"60%", "side":"bottom" } }
import { paint, font, cached, anim, num, margins, rngFor, toRGB } from 'vox-studio/kit/look.js';
import { hashStr, seededRandom } from 'vox-studio/core/helpers.js';
import { outCubic, tornPath } from 'vox-studio/kit/shapes.js';
import { clamp, bezier, wobble, strokePts, ellipsePts, wrapLines } from 'vox-studio/kit/marks.js';
import { edit, grain, placePiece } from 'vox-studio/kit/paper.js';

const FACES = ['text', 'typed', 'display'];
const SIDES = ['auto', 'left', 'right', 'top', 'bottom'];

export default {
  meta: {
    name: 'callout', category: 'annotations',
    use: 'A short label on a torn paper slip, joined by a hand-drawn line to a ring on the thing it describes. x and y are the target; side says where the label sits (auto picks one). Use for "this is the flag", "he was 27".',
    avoid: 'Long text (keep under about 10 words), more than two at once, or labels with no clear target (use paperScrap).',
    slots: { text: 'string' },
    options: { side: 'enum:auto|left|right|top|bottom', gap: 'number?', size: 'number?', face: 'enum:text|typed|display', fill: 'color?', color: 'color?', width: 'number?', curve: 'number?' },
    defaultDuration: 3, space: 'world', depth: 0.8,
    example: { slots: { text: 'Last flag lowered' }, options: { side: 'bottom', gap: 130 } },
  },

  draw(ctx, o, env) {
    const { W, H, theme } = env, { a, x } = anim(o);
    if (a <= 0.001) return;
    const m = margins(env), rng = rngFor(env, 'callout'), face = FACES.includes(o.face) ? o.face : 'text';
    const text = String(o.text ?? '').trim().slice(0, 100), weight = face === 'display' ? '400' : '600';
    const size = Math.round(clamp(num(o.size, W > H ? 38 : 44), 20, 100)), pad = Math.round(size * 0.7), Q = 46;
    const maxW = clamp(num(o.w, (W - m.left - m.right) * 0.5), 200, W - m.left - m.right);
    ctx.save();
    ctx.font = font(theme, face, size, weight);
    const lines = wrapLines(ctx, text, maxW - pad * 2), widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    ctx.restore();
    const fw = Math.max(160, Math.ceil(widest + pad * 2)) + 12, fh = Math.ceil(lines.length * size * 1.2 + pad * 1.2) + 12;
    const slip = paint(theme, o.fill, 'white'), [r, g, b] = Array.from(toRGB(slip));
    const fg = 0.299 * r + 0.587 * g + 0.114 * b < 150 ? paint(theme, 'white') : paint(theme, 'ink');
    const spr = cached(env, `callout:${text}:${face}:${size}:${slip}:${fg}:${fw}x${fh}`, fw + 2 * Q, fh + 2 * Q,
      (c) => paintLabel(c, env, { fw, fh, Q, lines, size, face, weight, slip, fg, text }));

    const tx = num(o.x, W / 2), ty = num(o.y, H / 2), gap = clamp(num(o.gap, 130), 40, 600), mid = (m.top + H - m.bottom) / 2;
    const side = SIDES.includes(o.side) && o.side !== 'auto' ? o.side : W > H ? (tx < W / 2 ? 'right' : 'left') : ty > mid ? 'top' : 'bottom';
    let cx = tx + (side === 'right' ? gap + fw / 2 : side === 'left' ? -gap - fw / 2 : 0);
    let cy = ty + (side === 'bottom' ? gap + fh / 2 : side === 'top' ? -gap - fh / 2 : 0);
    cx = clamp(cx, m.left + fw / 2, Math.max(m.left + fw / 2, W - m.right - fw / 2));
    cy = clamp(cy, m.top + fh / 2, Math.max(m.top + fh / 2, H - m.bottom - fh / 2));

    const dx = tx - cx, dy = ty - cy, dist = Math.hypot(dx, dy) || 1, ux = dx / dist, uy = dy / dist, rr = 16;
    const edge = Math.min((fw / 2 - 6) / (Math.abs(ux) || 1e-6), (fh / 2 - 6) / (Math.abs(uy) || 1e-6));
    const A = [cx + ux * edge, cy + uy * edge], B = [tx - ux * rr, ty - uy * rr];
    const ab = [B[0] - A[0], B[1] - A[1]], bend = clamp(num(o.curve, 0.14), -0.5, 0.5) * Math.hypot(ab[0], ab[1]);
    const off = (k) => [A[0] + ab[0] * k - uy * bend, A[1] + ab[1] * k + ux * bend];
    const lead = wobble(bezier(A, off(0.33), off(0.66), B, 30), rng, 2);
    const ring = wobble(ellipsePts(rr, rr, 20, -1, Math.PI * 2.2), rng, 1.2).map(([px, py]) => [px + tx, py + ty]);
    const tilt = rngFor(env, 'tilt').range(-1.6, 1.6), s = outCubic(Math.min(1, a / 0.5));
    const col = paint(theme, o.color, 'accent1'), wd = clamp(num(o.width, theme.line.thin + 2), 2, 24);

    ctx.save();
    ctx.globalAlpha *= 1 - x;
    strokePts(ctx, lead, col, wd, (a - 0.2) / 0.7);
    strokePts(ctx, ring, col, wd, (a - 0.85) / 0.15);
    ctx.globalAlpha *= Math.min(1, a * 3);
    ctx.translate(cx, cy + (1 - s) * 30); ctx.rotate((tilt * Math.PI) / 180); ctx.scale(0.94 + 0.06 * s, 0.94 + 0.06 * s);
    ctx.drawImage(spr, -(fw + 2 * Q) / 2, -(fh + 2 * Q) / 2);
    ctx.restore();
  },
};

function paintLabel(c, env, d) {
  const { theme } = env, { fw, fh, Q, lines, size, face, weight, slip, fg, text } = d, sd = hashStr(text) | 0;
  const P = env.createCanvas(fw, fh), g = P.getContext('2d');
  g.save(); g.translate(fw / 2, fh / 2);
  tornPath(g, fw - 12, fh - 12, seededRandom(hashStr(`callout:${text}:${fw}x${fh}`)), theme.edge.tornAmp * 0.6, theme.edge.tornStep);
  g.fillStyle = slip; g.fill(); g.restore();
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font(theme, face, size, weight);
  lines.forEach((l, i) => g.fillText(l, fw / 2, fh / 2 + (i - (lines.length - 1) / 2) * size * 1.2));
  edit(g, fw, fh, (p, i, px, py) => {
    if (!p[i + 3]) return;
    const n = (grain(px, py, sd + 7) - 0.5) * 8;
    p[i] += n; p[i + 1] += n; p[i + 2] += n;
  });
  placePiece(c, env, P, fw, fh, Q);
}
