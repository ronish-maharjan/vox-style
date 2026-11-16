// props/annotations/checkMark/index.js — hand-drawn tick, optionally inside a loose circle or box, for "yes / confirmed / true". Usage: { "prop":"checkMark", "options":{ "x":"30%", "y":"40%", "w":"26%", "shape":"circle" } }
import { paint, place, anim, num, rngFor } from 'vox-studio/kit/look.js';
import { clamp, densify, wobble, strokePts, ellipsePts } from 'vox-studio/kit/marks.js';

const SHAPES = ['none', 'circle', 'box'];

export default {
  meta: {
    name: 'checkMark', category: 'annotations',
    use: 'A marker tick that draws itself, alone or inside a hand-drawn circle or box. Good for confirmed facts, pro/con lists and "this one is right". w sets the size.',
    avoid: 'More than three at once, or ticks with nothing next to them to confirm.',
    slots: {},
    options: { shape: 'enum:none|circle|box', color: 'color?', width: 'number?' },
    defaultDuration: 2, space: 'world', depth: 0.8,
    example: { slots: {}, options: { shape: 'circle', color: 'accent2' } },
  },

  draw(ctx, o, env) {
    const { W, H, theme } = env, { a, x } = anim(o);
    if (a <= 0.001) return;
    const rng = rngFor(env, 'check');
    const shape = SHAPES.includes(o.shape) ? o.shape : 'none';
    const s = clamp(num(o.w, W > H ? 220 : 240), 60, W) / 2, k = shape === 'none' ? s * 0.95 : s * 0.62;
    const wd = clamp(num(o.width, theme.line.bold), 3, 40), col = paint(theme, o.color, 'accent2');
    const tick = wobble(densify([[-0.62 * k, 0.02 * k], [-0.2 * k, 0.5 * k], [0.7 * k, -0.55 * k]], 12), rng, 2.5);
    const frame = shape === 'box'
      ? wobble(densify([[-s, -s], [s, -s * 0.97], [s * 0.98, s], [-s, s * 0.96], [-s * 0.99, -s * 0.9]], 14), rng, 3)
      : wobble(ellipsePts(s, s * 0.96), rng, 3);

    ctx.save();
    place(ctx, { ...o, x: num(o.x, W / 2), y: num(o.y, H / 2), rot: num(o.rot, 0), scale: num(o.scale, 1) }, env);
    ctx.globalAlpha *= 1 - x;
    if (shape !== 'none') strokePts(ctx, frame, col, wd * 0.8, a / 0.55);
    strokePts(ctx, tick, col, wd * 1.3, shape === 'none' ? a : (a - 0.45) / 0.55);
    ctx.restore();
  },
};
