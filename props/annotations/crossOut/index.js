// props/annotations/crossOut/index.js — hand-drawn X, strike-through or scribble over something to reject it. Usage: { "prop":"crossOut", "options":{ "x":"50%", "y":"36%", "w":"70%", "h":"16%", "style":"x" } }
import { paint, place, anim, num, margins, rngFor } from 'vox-studio/kit/look.js';
import { clamp, densify, wobble, strokePts } from 'vox-studio/kit/marks.js';

const STYLES = ['x', 'strike', 'scribble'];

export default {
  meta: {
    name: 'crossOut', category: 'annotations',
    use: 'A marker X, strike-through line or scribble drawn over a photo, a word or a number to say "wrong", "gone" or "abolished". Set x, y, w, h to cover the thing.',
    avoid: 'Using it on more than one thing at a time, or as decoration with nothing to reject.',
    slots: {},
    options: { style: 'enum:x|strike|scribble', color: 'color?', width: 'number?' },
    defaultDuration: 2, space: 'world', depth: 0.8,
    example: { slots: {}, options: { style: 'x', color: 'accent1' } },
  },

  draw(ctx, o, env) {
    const { W, H, theme } = env, { a, x } = anim(o);
    if (a <= 0.001) return;
    const m = margins(env), rng = rngFor(env, 'cross');
    const style = STYLES.includes(o.style) ? o.style : 'x';
    const w = clamp(num(o.w, (W - m.left - m.right) * 0.6), 60, W);
    const h = clamp(num(o.h, style === 'strike' ? 40 : w * 0.55), 10, W);
    const wd = clamp(num(o.width, theme.line.bold * 1.3), 3, 40), col = paint(theme, o.color, 'accent1');
    const n = Math.max(6, Math.round(w / 60)), zig = [];
    for (let i = 0; i <= n; i++) zig.push([-w / 2 + (w * i) / n, (i % 2 ? 1 : -1) * h * 0.45]);
    const raw = style === 'x' ? [[[-w / 2, -h / 2], [w / 2, h / 2]], [[w / 2, -h / 2], [-w / 2, h / 2]]]
      : style === 'strike' ? [[[-w / 2, h * 0.15], [w / 2, -h * 0.15]]] : [zig];
    const strokes = raw.map((s) => wobble(densify(s, 14), rng, 3));

    ctx.save();
    place(ctx, { ...o, x: num(o.x, W / 2), y: num(o.y, H / 2), rot: num(o.rot, 0), scale: num(o.scale, 1) }, env);
    ctx.globalAlpha *= 1 - x;
    strokes.forEach((s, k) => strokePts(ctx, s, col, wd, a * strokes.length - k));
    ctx.restore();
  },
};
