// props/annotations/highlighter/index.js — yellow highlighter swipe. Usage: { "prop":"highlighter", "options":{ "x":540, "y":900, "w":600, "h":70 }, "at":"word:harbour" }
import { paint, place, anim, num, rngFor, clamp01 } from 'vox-studio/kit/look.js';
import { highlightBar, outCubic } from 'vox-studio/kit/shapes.js';

export default {
  meta: {
    name: 'highlighter', category: 'annotations',
    use: 'A highlighter swipe across something already on screen (a line of text, a number, part of a photo). x/y/w/h describe the target area.',
    avoid: 'Highlighting empty space, more than one target at once, or using it as a background. For a headline inside newspaperClip use that prop\'s "mark" option.',
    slots: {},
    options: { color: 'color?' },
    defaultDuration: 1.2, space: 'world', depth: 0.6, enter: 0.45,
    example: { slots: {}, options: { x: 540, y: 800, w: 520, h: 70 } },
  },

  draw(ctx, o, env) {
    const { W, H, theme } = env;
    const { a, x } = anim(o);
    if (a <= 0.001 || x >= 1) return;
    ctx.save();
    place(ctx, { ...o, x: num(o.x, W / 2), y: num(o.y, H / 2) }, env);
    ctx.globalAlpha *= (1 - x);
    highlightBar(ctx, num(o.w, 500), num(o.h, 70), outCubic(clamp01(a)), rngFor(env, 'hl'), paint(theme, o.color, 'highlight'));
    ctx.restore();
  },
};
