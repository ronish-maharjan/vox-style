// props/_template/index.js — copy to props/<category>/<name>/index.js, rename, edit meta + draw. See props/PROTOCOL.md
import { dropShadow, fitText } from 'vox-studio/core/helpers.js';

export default {
  meta: {
    name: 'templateCard',
    category: 'misc',
    use: 'One line: when should an AI choose this prop?',
    avoid: 'One line: when should it NOT be used?',
    slots: { label: 'string' },
    options: { x: 'length?', y: 'length?', w: 'length?', rot: 'number?', opacity: 'range:0..1?' },
    defaultDuration: 3,
    enterEase: 'easeOutBack',
    example: { slots: { label: 'HELLO' }, options: { x: '50%', y: '40%', w: 600, rot: -3 } },
  },
  draw(ctx, o, env) {
    const { theme } = env, c = theme.colors;
    const x = o.x ?? env.W / 2, y = o.y ?? env.H / 2, w = o.w ?? 600, h = w * 0.4;
    const a = Math.min(o.appear, 1.2), alpha = Math.min(1, o.appear) * (1 - o.exit);
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(x, y); ctx.rotate(((o.rot ?? 0) * Math.PI) / 180); ctx.scale(0.8 + 0.2 * a, 0.8 + 0.2 * a);
    dropShadow(ctx, theme, () => { ctx.fillStyle = c.white; ctx.fillRect(-w / 2, -h / 2, w, h); });
    const fit = fitText(ctx, o.label ?? 'label', { maxW: w * 0.88, maxH: h * 0.8, family: theme.fonts.display, weight: '400', maxSize: 120 });
    ctx.fillStyle = c.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lh = fit.size * fit.lineHeight;
    fit.lines.forEach((line, i) => ctx.fillText(line, 0, (i + 0.5) * lh - (fit.lines.length * lh) / 2));
    ctx.restore();
  },
};
