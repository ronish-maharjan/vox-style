// props/text/titleCard/index.js — opening title: display headline + marker underline + optional subtitle.
// Usage: { "prop": "titleCard", "slots": { "title": "THE LAST DAY", "subtitle": "Hong Kong, 1997" }, "at": "start" }
import { paint, font, place, anim, num, margins, rngFor, clamp01 } from 'vox-studio/kit/look.js';
import { markerStroke } from 'vox-studio/core/helpers.js';

export default {
  meta: {
    name: 'titleCard', category: 'text',
    use: 'The opening title of the video: a big display headline with a hand-drawn marker underline that draws itself, and an optional smaller subtitle under it. Also works as a section title mid-video.',
    avoid: 'Long titles (keep under about 6 words; use paperScrap for labels), more than one per video start, or body text (use letterPage).',
    slots: { title: 'string', subtitle: 'string?' },
    options: { color: 'color?', subColor: 'color?', size: 'range:0.4..1.4?' },
    defaultDuration: 4, space: 'world', depth: 0.5, enter: 0.7,
    defaultSize: { w: 900, h: 500 },
    example: { slots: { title: 'THE LAST DAY', subtitle: 'Hong Kong, 1997' }, options: {} },
  },

  draw(ctx, o, env) {
    const { W, H, theme } = env, c = theme.colors;
    const m = margins(env);
    const { a, x } = anim(o);
    const vis = clamp01(a * 3) * (1 - x);
    if (vis <= 0.001) return;

    const scale = num(o.size, 1);
    const availW = Math.min(W - m.left - m.right, 980);
    const title = String(o.title ?? 'TITLE').toUpperCase();
    const sub = o.subtitle ? String(o.subtitle) : null;

    ctx.save();
    ctx.globalAlpha *= vis;
    place(ctx, o, env);

    // title: shrink to fit the safe width
    let size = Math.round(120 * scale);
    ctx.font = font(theme, 'display', size, '400');
    while (ctx.measureText(title).width > availW && size > 40) {
      size -= 4;
      ctx.font = font(theme, 'display', size, '400');
    }
    const rise = (1 - a) * 36;
    ctx.translate(0, rise);

    ctx.fillStyle = paint(theme, o.color, 'ink');
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(title, 0, 0);

    const tw = ctx.measureText(title).width;

    // hand-drawn underline that draws itself (a hair after the title lands)
    const uw = Math.min(tw * 1.05, availW);
    const rng = rngFor(env, 'underline');
    const strokeA = clamp01((a - 0.55) / 0.45);
    const y0 = size * 0.18;
    ctx.save();
    ctx.translate(-uw / 2, y0);
    markerStroke(ctx, [{ x: 0, y: 0 }, { x: uw, y: 0 }], strokeA, {
      color: paint(theme, o.color === undefined ? undefined : o.color, 'accent1'),
      width: Math.max(6, size * 0.06), wobble: 4, rng, step: 26,
    });
    ctx.restore();

    // subtitle (typed face, wipes in with a paper-coloured mask)
    if (sub) {
      const ss = Math.round(40 * scale);
      ctx.font = font(theme, 'typed', ss, '400');
      const sw = ctx.measureText(sub).width;
      const sy = y0 + ss * 1.9;
      const subA = clamp01((a - 0.75) / 0.25);
      ctx.save();
      ctx.beginPath();
      ctx.rect(-sw / 2 - 10, sy - ss, (sw + 20) * subA, ss * 1.5);
      ctx.clip();
      ctx.fillStyle = paint(theme, o.subColor, 'inkSoft');
      ctx.fillText(sub, 0, sy);
      ctx.restore();
    }

    ctx.restore();
  },
};
