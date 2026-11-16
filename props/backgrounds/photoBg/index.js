// props/backgrounds/photoBg/index.js — environment photo behind the scene: full-frame washed photo or a big torn photo sheet, graded like the other prints. Usage: { "prop":"photoBg", "slots":{ "src":"harbour" }, "options":{ "mode":"full", "look":"muted", "wash":0.5 }, "depth":0.1, "at":"start" }
import { paint, cached, imageOf, anim, num, rngFor } from 'vox-studio/kit/look.js';
import { hashStr } from 'vox-studio/core/helpers.js';
import { LOOKS, clamp, gradePhoto, missingBox, placePiece } from 'vox-studio/kit/paper.js';
import { tornPath } from 'vox-studio/kit/shapes.js';
import { rgba } from 'vox-studio/kit/doc.js';

export default {
  meta: {
    name: 'photoBg', category: 'backgrounds',
    use: 'A photo of the place or era behind the scene, washed toward paper so the props on top stay readable. Fills the empty space of a shot: put it first, keep depth low (about 0.1) and put stickers at high depth (about 0.9) so the camera makes them move at different speeds. mode "full" fills the frame, "sheet" is a torn paper sheet (put paperBg under it). focus [x,y] picks which part of the photo stays in frame.',
    avoid: 'Two backgrounds at once (except paperBg under mode sheet), a very busy photo behind text-heavy props (raise wash to 0.7), or tiny low-resolution photos.',
    slots: { src: 'asset' },
    options: { mode: 'enum:full|sheet?', look: 'enum:bw|muted|color|halftone?', wash: 'range:0..0.9?', focus: 'array?', drift: 'range:0..0.08?', tint: 'color?' },
    defaultDuration: 4, space: 'world', depth: 0.1, enter: 0.6,
    example: { slots: { src: 'assets/sample/skyline.png' }, options: { mode: 'full', look: 'muted', wash: 0.5 } },
  },

  draw(ctx, o, env) {
    const { W, H } = env;
    const { a, x } = anim(o);
    const vis = a * (1 - x);
    if (vis <= 0.001) return;
    const sheet = o.mode === 'sheet', look = LOOKS[o.look] ? o.look : 'muted';
    const wash = clamp(num(o.wash, sheet ? 0.35 : 0.5), 0, 0.9), drift = clamp(num(o.drift, 0.04), 0, 0.08);
    const img = o.src ? imageOf(env, o.src) : null, foc = pt(o.focus);
    const rng = rngFor(env, 'photoBg'), dir = rng.range(0, 1) < 0.5 ? -1 : 1, tilt = sheet ? rng.range(-0.02, 0.02) : 0;
    const p = clamp(num(env.p, 0), 0, 1);
    const bw = Math.ceil(W * (sheet ? 0.94 : 1.12)), bh = Math.ceil(H * (sheet ? 0.9 : 1.12)), Q = sheet ? 46 : 0;
    const sw = bw + 2 * Q, sh = bh + 2 * Q;
    const key = `photoBg:${o.src}:${img ? `${img.width}x${img.height}` : 'none'}:${sheet ? 'sheet' : 'full'}:${look}:${wash}:${foc}:${o.tint ?? ''}:${bw}x${bh}`;
    const spr = cached(env, key, sw, sh, (c) => paintBg(c, env, img, o, { bw, bh, Q, sheet, look, wash, foc }));

    ctx.save();
    ctx.globalAlpha *= vis;
    ctx.translate(num(o.x, W / 2) + dir * (p - 0.5) * drift * W, num(o.y, H / 2));
    if (tilt) ctx.rotate(tilt);
    ctx.scale(1 + drift * p, 1 + drift * p);
    ctx.drawImage(spr, -sw / 2, -sh / 2);
    ctx.restore();
  },
};

/** Crop anchor [x,y] in 0..1 (default centre). */
function pt(v) {
  if (!Array.isArray(v) || v.length < 2) return [0.5, 0.5];
  return [clamp(num(v[0], 0.5), 0, 1), clamp(num(v[1], 0.5), 0, 1)];
}

/** Graded, washed, vignetted photo; as a torn sheet with shadow when sheet is true. */
function paintBg(c, env, img, o, d) {
  const { theme } = env, { bw, bh, Q, sheet, look, wash, foc } = d;
  const P = env.createCanvas(bw, bh), g = P.getContext('2d');
  if (img) {
    const s = Math.max(bw / img.width, bh / img.height), cw = bw / s, ch = bh / s;
    g.drawImage(img, (img.width - cw) * foc[0], (img.height - ch) * foc[1], cw, ch, 0, 0, bw, bh);
  } else missingBox(g, theme, o.src, bw, bh);
  gradePhoto(g, bw, bh, env, look, hashStr(String(o.src)) | 0);
  g.globalAlpha = wash; g.fillStyle = paint(theme, o.tint, 'paper'); g.fillRect(0, 0, bw, bh); g.globalAlpha = 1;
  const v = g.createRadialGradient(bw / 2, bh / 2, Math.min(bw, bh) * 0.35, bw / 2, bh / 2, Math.hypot(bw, bh) / 2);
  v.addColorStop(0, rgba(theme, 'ink', 0)); v.addColorStop(1, rgba(theme, 'ink', 0.22));
  g.fillStyle = v; g.fillRect(0, 0, bw, bh);
  if (!sheet) { c.drawImage(P, 0, 0); return; }

  const S = env.createCanvas(bw, bh), s = S.getContext('2d');
  const tear = () => { s.beginPath(); tornPath(s, bw, bh, rngFor(env, 'photoBgTear'), 6, 30); };
  s.save();
  s.translate(bw / 2, bh / 2); tear(); s.clip();
  s.translate(-bw / 2, -bh / 2); s.drawImage(P, 0, 0);
  s.translate(bw / 2, bh / 2); tear();
  s.strokeStyle = paint(theme, 'white'); s.lineWidth = 8; s.stroke();
  s.restore();
  placePiece(c, env, S, bw, bh, Q);
}
