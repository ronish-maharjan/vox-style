// props/annotations/underline/index.js — hand-drawn marker underline (single, double or wavy) that draws itself under a word or number. Usage: { "prop":"underline", "options":{ "x":"50%", "y":"66%", "w":"60%", "style":"double" } }
import { paint, place, anim, num, margins, rngFor } from 'vox-studio/kit/look.js';
import { clamp, densify, wobble, strokePts } from 'vox-studio/kit/marks.js';

const STYLES = ['single', 'double', 'wave'];

export default {
  meta: {
    name: 'underline', category: 'annotations',
    use: 'A marker underline drawn under a key word, name or number. x and y are the centre of the line, w its width. Place it just below the text it emphasises.',
    avoid: 'Use highlighter for a filled bar behind text and markerCircle to ring something. Do not stack more than two underlines on screen.',
    slots: {},
    options: { style: 'enum:single|double|wave', color: 'color?', width: 'number?' },
    defaultDuration: 2, space: 'world', depth: 0.8,
    example: { slots: {}, options: { style: 'double', color: 'accent1' } },
  },

  draw(ctx, o, env) {
    const { W, H, theme } = env, { a, x } = anim(o);
    if (a <= 0.001) return;
    const m = margins(env), rng = rngFor(env, 'underline');
    const style = STYLES.includes(o.style) ? o.style : 'single';
    const w = clamp(num(o.w, (W - m.left - m.right) * 0.5), 60, W);
    const wd = clamp(num(o.width, theme.line.bold), 3, 40), col = paint(theme, o.color, 'accent1');
    let raw;
    if (style === 'wave') {
      const n = Math.max(3, Math.round(w / 70)), pts = [];
      for (let i = 0; i <= n * 4; i++) pts.push([-w / 2 + (w * i) / (n * 4), Math.sin((i / 4) * Math.PI * 2) * wd * 0.8]);
      raw = [pts];
    } else {
      raw = [[[-w / 2, 0], [w / 2, -w * 0.012]]];
      if (style === 'double') raw.push([[-w * 0.46, wd * 2.1], [w * 0.5, wd * 2.1 - w * 0.01]]);
    }
    const strokes = raw.map((s) => wobble(densify(s, 14), rng, 2));
    const N = strokes.length, span = 1 - (N - 1) * 0.35;

    ctx.save();
    place(ctx, { ...o, x: num(o.x, W / 2), y: num(o.y, H / 2), rot: num(o.rot, 0), scale: num(o.scale, 1) }, env);
    ctx.globalAlpha *= 1 - x;
    strokes.forEach((s, k) => strokePts(ctx, s, col, wd, (a - k * 0.35) / span));
    ctx.restore();
  },
};
