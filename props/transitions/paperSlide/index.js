// props/transitions/paperSlide/index.js — torn kraft sheets slide across. Usage: shot.transition = { "type":"paperSlide", "duration":0.7 }
import { paint, rngFor, clamp01 } from 'vox-studio/kit/look.js';
import { dropShadow } from 'vox-studio/core/helpers.js';
import { inOutCubic } from 'vox-studio/kit/shapes.js';

export default {
  meta: {
    name: 'paperSlide', category: 'transitions',
    use: 'Two torn paper sheets (tomato under kraft) sweep right-to-left across the frame. The signature paper-craft cut for topic changes.',
    avoid: 'Using it on every cut, or durations under 0.5 s (the torn edges need time to read).',
    slots: {},
    options: { color: 'color?' },
    defaultDuration: 0.7, space: 'screen',
    example: { slots: {}, options: {} },
  },

  draw(ctx, o, env) {
    const { W, H, theme } = env;
    const p = clamp01(o.progress);
    if (p <= 0.001 || p >= 0.999) return;
    const S = W * 1.3, step = 36, steps = Math.ceil(H / step) + 2, rng = rngFor(env, 'ps');
    const jit = () => Array.from({ length: steps }, () => rng.range(-9, 9));
    const jUL = jit(), jUR = jit(), jKL = jit(), jKR = jit();
    const sheet = (pp, fill, jl, jr) => () => {
      const left = W - (W + S) * inOutCubic(pp);
      ctx.fillStyle = fill; ctx.beginPath();
      for (let i = 0; i < steps; i++) { const px = left + jl[i], py = -20 + i * step; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      for (let i = steps - 1; i >= 0; i--) ctx.lineTo(left + S + jr[i], -20 + i * step);
      ctx.closePath(); ctx.fill();
    };
    ctx.save();
    dropShadow(ctx, theme, sheet(clamp01(p * 1.1), paint(theme, 'accent1'), jUL, jUR), {});
    dropShadow(ctx, theme, sheet(p, paint(theme, o.color, 'kraft'), jKL, jKR), {});
    ctx.restore();
  },
};
