// props/data/bigNumber/index.js — one huge number with a label. Usage: { "prop":"bigNumber", "slots":{ "value":"156", "label":"years of British rule" }, "at":"start" }
import { paint, font, place, anim, num, margins, rngFor, clamp01 } from 'vox-studio/kit/look.js';
import { highlightBar, fitFont, outCubic } from 'vox-studio/kit/shapes.js';

export default {
  meta: {
    name: 'bigNumber', category: 'data',
    use: 'One huge number or year as the star of the shot, with a short label under it. Prefer this to a paragraph whenever a fact is a number.',
    avoid: 'More than one number at once (use barChart to compare), labels longer than about 6 words, or very long values.',
    slots: { value: 'string', label: 'string?' },
    options: { color: 'color?', highlight: 'boolean?', size: 'range:0.3..1' },
    defaultDuration: 3, defaultSize: { w: 760, h: 620 }, space: 'world', depth: 0.45, enter: 0.6,
    example: { slots: { value: '156', label: 'years of British rule' }, options: {} },
  },

  draw(ctx, o, env) {
    const { W, H, theme } = env;
    const { a, x } = anim(o);
    const vis = clamp01(a * 4) * (1 - x);
    if (vis <= 0.001) return;
    const m = margins(env), maxW = (W - m.left - m.right) * num(o.size, 0.9);
    const v = String(o.value ?? ''), lab = o.label ? String(o.label) : '';
    const fs = fitFont(ctx, theme, 'display', v, 400, '', maxW, 80);
    const tw = ctx.measureText(v).width;
    const ls = lab ? fitFont(ctx, theme, 'text', lab, 46, '700', maxW, 22) : 0;
    const numH = fs * 0.86, total = numH + (lab ? 30 + ls * 1.2 : 0);
    const ny = -total / 2 + numH / 2;
    const s = outCubic(clamp01(a / 0.5)), hp = outCubic(clamp01((a - 0.4) / 0.6)), lp = clamp01((a - 0.5) / 0.4);

    ctx.save();
    place(ctx, { ...o, x: num(o.x, W / 2), y: num(o.y, (m.top + H - m.bottom) / 2), rot: num(o.rot, -2), scale: num(o.scale, 1) * (0.85 + 0.15 * s) }, env);
    ctx.translate(0, (1 - s) * 60);
    ctx.globalAlpha *= vis;
    if (o.highlight !== false) {
      ctx.save();
      ctx.translate(0, ny + fs * 0.3);
      highlightBar(ctx, tw + 50, fs * 0.3, hp, rngFor(env, 'hl'), paint(theme, 'highlight'));
      ctx.restore();
    }
    ctx.font = font(theme, 'display', fs);
    ctx.fillStyle = paint(theme, o.color, 'ink'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(v, 0, ny + fs * 0.04);
    if (lab && lp > 0) {
      ctx.globalAlpha *= lp;
      ctx.font = font(theme, 'text', ls, '700');
      ctx.fillStyle = paint(theme, 'inkSoft');
      ctx.fillText(lab, 0, -total / 2 + numH + 30 + ls * 0.6 + (1 - lp) * 14);
    }
    ctx.restore();
  },
};
