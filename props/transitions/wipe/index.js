// props/transitions/wipe/index.js — straight wipe between shots. Usage: shot.transition = { "type":"wipe", "duration":0.5, "options":{ "direction":"left" } }
import { paint, clamp01 } from 'vox-studio/kit/look.js';
import { inOutCubic } from 'vox-studio/kit/shapes.js';

export default {
  meta: {
    name: 'wipe', category: 'transitions',
    use: 'A clean straight wipe between two shots; the neutral default. A highlight-yellow band leads the edge.',
    avoid: 'Using the same transition on every cut (vary it with paperSlide), or durations under 0.3 s.',
    slots: {},
    options: { direction: 'enum:left|right|up|down', color: 'color?' },
    defaultDuration: 0.5, space: 'screen',
    example: { slots: {}, options: { direction: 'left' } },
  },

  draw(ctx, o, env) {
    const { W, H, theme } = env;
    const p = clamp01(o.progress);
    if (p <= 0.001 || p >= 0.999) return;
    const dir = o.direction ?? 'left', horiz = dir === 'left' || dir === 'right', rev = dir === 'right' || dir === 'down';
    const L = horiz ? W : H, c = p < 0.5 ? inOutCubic(p * 2) : 1 - inOutCubic(p * 2 - 1);
    let [s0, s1] = p < 0.5 ? [L - c * L, L] : [0, c * L];
    if (rev) [s0, s1] = [L - s1, L - s0];
    const edgeIsStart = p < 0.5 ? !rev : rev, band = Math.min(34, s1 - s0);
    const rect = (a0, a1) => (horiz ? ctx.fillRect(a0, 0, a1 - a0, H) : ctx.fillRect(0, a0, W, a1 - a0));
    ctx.save();
    ctx.fillStyle = paint(theme, o.color, 'ink'); rect(s0, s1);
    ctx.globalAlpha *= clamp01(Math.abs(p - 0.5) * 12);
    ctx.fillStyle = paint(theme, 'highlight');
    if (edgeIsStart) rect(s0, s0 + band); else rect(s1 - band, s1);
    ctx.restore();
  },
};
