// props/collage/tapeLabel/index.js — a strip of masking tape with typed text, stuck over a photo or paper. Usage: { "prop":"tapeLabel", "slots":{ "text":"EXHIBIT A" }, "options":{ "x":"50%", "y":"22%" } }
import { paint, font, num, margins, rngFor } from 'vox-studio/kit/look.js';
import { clamp, stage, enterState, tapeStrip } from 'vox-studio/kit/paper.js';

export default {
  meta: {
    name: 'tapeLabel', category: 'collage',
    use: 'A short typed label on a strip of masking tape: "EXHIBIT A", a date, a name. Stick it across the corner of a polaroid or cutout with x and y.',
    avoid: 'Long text (keep under about 24 characters), or using it as the main title (use paperScrap or a title prop).',
    slots: { text: 'string' },
    options: { color: 'color?', textColor: 'color?', size: 'number?' },
    defaultDuration: 3, space: 'world', depth: 0.7,
    example: { slots: { text: 'EXHIBIT A' }, options: {} },
  },

  draw(ctx, o, env) {
    const { W, theme } = env;
    const { a, vis } = enterState(o);
    if (vis <= 0.001) return;
    const m = margins(env), text = String(o.text ?? '').trim().slice(0, 60);
    const size = Math.round(clamp(num(o.size, W > 1500 ? 38 : 46), 16, 120));
    ctx.save();
    stage(ctx, env, o, a, 4);
    ctx.globalAlpha *= vis;
    ctx.font = font(theme, 'typed', size, '400');
    const w = Math.round(Math.min(W - m.left - m.right, ctx.measureText(text).width + size * 1.6)), h = Math.round(size * 1.7);
    tapeStrip(ctx, theme, w, h, rngFor(env, 'tape'), paint(theme, o.color, 'tape'));
    ctx.globalAlpha *= 0.9;
    ctx.fillStyle = o.textColor ? paint(theme, o.textColor) : paint(theme, 'ink');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 2, w - size * 1.2);
    ctx.restore();
  },
};
