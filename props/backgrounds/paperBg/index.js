// props/backgrounds/paperBg/index.js — textured paper backdrop. Usage: { "prop":"paperBg", "options":{ "variant":"grid" } }
import { paint, cached, anim, num } from 'vox-studio/kit/look.js';
import { hashStr, seededRandom } from 'vox-studio/core/helpers.js';

export default {
  meta: {
    name: 'paperBg', category: 'backgrounds',
    use: 'Textured paper backdrop (plain, grid, lined, dots or kraft). Put it first in a shot to give the scene a tactile base.',
    avoid: 'Stacking two backgrounds in one shot, or expecting it to carry content; it is only a surface.',
    slots: {},
    options: { variant: 'enum:plain|grid|lined|dots|kraft', tint: 'color?' },
    defaultDuration: 4, space: 'world', depth: 0,
    example: { slots: {}, options: { variant: 'grid' } },
  },

  draw(ctx, o, env) {
    const { W, H } = env;
    const { a, x } = anim(o);
    const vis = a * (1 - x);
    if (vis <= 0.001) return;
    const variant = o.variant ?? 'plain';
    const sw = Math.ceil(W * 1.5), sh = Math.ceil(H * 1.5);
    const spr = cached(env, `paperBg:${variant}:${o.tint ?? ''}:${sw}x${sh}`, sw, sh, (c, w, h) => paintPaper(c, w, h, variant, o.tint, env));
    ctx.save();
    ctx.globalAlpha *= vis;
    ctx.drawImage(spr, num(o.x, W / 2) - sw / 2, num(o.y, H / 2) - sh / 2);
    ctx.restore();
  },
};

function paintPaper(c, w, h, variant, tint, env) {
  const { theme } = env;
  const rng = seededRandom(hashStr(`paperBg:${variant}:${w}x${h}`));
  const kraft = variant === 'kraft';
  const ink = paint(theme, 'ink');
  c.fillStyle = kraft ? paint(theme, 'kraft') : paint(theme, tint, 'paper');
  c.fillRect(0, 0, w, h);

  // soft mottling
  const blot = paint(theme, kraft ? 'ink' : 'paperDark');
  for (let i = 0; i < 16; i++) {
    const bx = rng.range(0, w), by = rng.range(0, h), br = rng.range(w * 0.1, w * 0.3);
    const g = c.createRadialGradient(bx, by, 0, bx, by, br);
    g.addColorStop(0, blot); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalAlpha = kraft ? 0.05 : 0.22; c.fillStyle = g; c.fillRect(bx - br, by - br, br * 2, br * 2);
  }
  // fibres
  c.lineCap = 'round'; c.strokeStyle = blot; c.lineWidth = 1;
  for (let i = 0, n = Math.round((w * h) / 2400); i < n; i++) {
    const fx = rng.range(0, w), fy = rng.range(0, h), len = rng.range(8, 30), ang = rng.range(0, Math.PI);
    c.globalAlpha = rng.range(0.08, 0.24);
    c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx + Math.cos(ang) * len, fy + Math.sin(ang) * len); c.stroke();
  }
  // speckles
  c.fillStyle = ink;
  for (let i = 0, n = Math.round((w * h) / 1800); i < n; i++) {
    c.globalAlpha = rng.range(0.04, 0.12);
    c.beginPath(); c.arc(rng.range(0, w), rng.range(0, h), rng.range(0.5, 1.3), 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;

  if (variant === 'grid') {
    const step = 54; c.strokeStyle = ink;
    for (let i = 0, p = 0; p < Math.max(w, h); i++, p += step) {
      c.globalAlpha = i % 5 === 0 ? 0.13 : 0.06; c.lineWidth = i % 5 === 0 ? 2 : 1.4;
      c.beginPath(); c.moveTo(p, 0); c.lineTo(p, h); c.moveTo(0, p); c.lineTo(w, p); c.stroke();
    }
  } else if (variant === 'lined') {
    c.strokeStyle = paint(theme, 'accent2'); c.lineWidth = 2; c.globalAlpha = 0.22;
    for (let y = 72; y < h; y += 72) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    c.strokeStyle = paint(theme, 'accent1'); c.globalAlpha = 0.35; c.lineWidth = 3;
    const mx = w / 2 - (w / 1.5) * 0.32;
    c.beginPath(); c.moveTo(mx, 0); c.lineTo(mx, h); c.stroke();
  } else if (variant === 'dots') {
    c.fillStyle = ink; c.globalAlpha = 0.16;
    for (let y = 27; y < h; y += 54) for (let x = 27; x < w; x += 54) { c.beginPath(); c.arc(x, y, 2.2, 0, Math.PI * 2); c.fill(); }
  }
  c.globalAlpha = 1;
}
