// props/annotations/arrow/index.js — hand-drawn marker arrow that draws itself toward a target point. Usage: { "prop":"arrow", "options":{ "x":"62%", "y":"40%", "dir":40, "length":"28%" } }
import { paint, place, anim, num, rngFor } from 'vox-studio/kit/look.js';
import { clamp, len, bezier, wobble, strokePts, arrowHead } from 'vox-studio/kit/marks.js';

export default {
  meta: {
    name: 'arrow', category: 'annotations',
    use: 'A hand-drawn marker arrow that draws itself and points at something: a face in a photo, a number, a place on a map. x and y are where the tip lands; dir is the direction it points (0 right, 90 down, -90 up).',
    avoid: 'More than two at once, or arrows with no clear target. Use callout when the arrow needs a label.',
    slots: {},
    options: { dir: 'number?', length: 'length?', curve: 'number?', color: 'color?', width: 'number?' },
    defaultDuration: 2.5, space: 'world', depth: 0.8,
    example: { slots: {}, options: { dir: 40, length: 360, curve: 0.25, color: 'accent1' } },
  },

  draw(ctx, o, env) {
    const { W, H, theme } = env, { a, x } = anim(o);
    if (a <= 0.001) return;
    const rng = rngFor(env, 'arrow');
    const L = clamp(len(o.length, W, W > H ? 420 : 380), 60, W);
    const ang = (num(o.dir, 40) * Math.PI) / 180, dx = Math.cos(ang), dy = Math.sin(ang);
    const bend = clamp(num(o.curve, 0.25), -0.8, 0.8) * L, wd = clamp(num(o.width, theme.line.bold + 2), 3, 40);
    // point at fraction k from tail (0) to tip (1), pushed sideways by `side`; the tip is the origin
    const at = (k, side) => [-dx * L * (1 - k) - dy * side, -dy * L * (1 - k) + dx * side];
    const pts = wobble(bezier(at(0, 0), at(0.33, bend), at(0.7, bend * 0.8), at(1, 0), 36), rng, 2.5);
    const head = arrowHead(pts, wd * 4.5), col = paint(theme, o.color, 'accent1');

    ctx.save();
    place(ctx, { ...o, x: num(o.x, W / 2), y: num(o.y, H / 2), rot: num(o.rot, 0), scale: num(o.scale, 1) }, env);
    ctx.globalAlpha *= 1 - x;
    strokePts(ctx, pts, col, wd, a / 0.85);
    strokePts(ctx, head, col, wd, (a - 0.8) / 0.2);
    ctx.restore();
  },
};
