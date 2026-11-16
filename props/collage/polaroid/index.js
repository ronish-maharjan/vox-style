// props/collage/polaroid/index.js — instant-print photo: off-white frame with thick bottom, graded photo, typed caption, taped on, two-layer shadow. Usage: { "prop":"polaroid", "slots":{ "src":"scene", "caption":"Victoria Harbour, 1997" }, "options":{ "look":"bw" } }
import { paint, font, cached, imageOf, num, margins, rrect, rngFor } from 'vox-studio/kit/look.js';
import { hashStr } from 'vox-studio/core/helpers.js';
import { LOOKS, clamp, rgb, edit, grain, gradePhoto, drawCover, placePiece, stage, enterState, tapeStrip } from 'vox-studio/kit/paper.js';

export default {
  meta: {
    name: 'polaroid', category: 'collage',
    use: 'A photo as an instant print: off-white frame, thicker bottom edge with a typed caption, a strip of tape on top. Good for dated archive shots, evidence and personal moments.',
    avoid: 'Cutting out a person or object (use stickerCutout), more than three at once, or long captions (keep under about 40 characters).',
    slots: { src: 'asset', caption: 'string?' },
    options: { look: 'enum:bw|muted|color|halftone', ratio: 'number?', mount: 'enum:tape|none' },
    defaultDuration: 3.5, defaultSize: { w: 640, h: 800 }, space: 'world', depth: 0.5,
    example: { slots: { src: 'assets/sample/skyline.png', caption: 'Victoria Harbour, 1997' }, options: { look: 'bw' } },
  },

  draw(ctx, o, env) {
    const { W, H, theme } = env;
    const { a, vis } = enterState(o);
    if (vis <= 0.001) return;
    const m = margins(env), img = imageOf(env, o.src), cap = String(o.caption ?? '').slice(0, 80);
    const look = LOOKS[o.look] ? o.look : 'bw', ratio = clamp(num(o.ratio, 1), 0.6, 1.6);
    const bot = cap ? 0.3 : 0.22, tall = 1 / ratio + 0.07 + bot;
    const availW = (W - m.left - m.right) * 0.94, availH = (H - m.top - m.bottom - 40) * 0.94;
    let pw = (o.w ? num(o.w, 600) : W > H ? 440 : 600) / 1.14;
    pw = Math.round(Math.max(60, Math.min(pw, availW / 1.14, availH / tall)));
    const side = Math.round(pw * 0.07), ph = Math.round(pw / ratio), bt = Math.round(pw * bot);
    const fw = pw + 2 * side, fh = side + ph + bt, Q = 46, sw = fw + 2 * Q, sh = fh + 2 * Q;
    const key = `polaroid:${o.src}:${img ? `${img.width}x${img.height}` : 'none'}:${cap}:${look}:${ratio}:${pw}`;
    const spr = cached(env, key, sw, sh, (c) => paintPolaroid(c, env, img, o.src, { pw, ph, side, bt, fw, fh, Q, look, cap }));

    ctx.save();
    stage(ctx, env, o, a);
    ctx.globalAlpha *= vis;
    ctx.drawImage(spr, -sw / 2, -sh / 2);
    if (o.mount !== 'none') {
      ctx.save(); ctx.translate(0, -fh / 2 + 6); ctx.rotate(-0.05);
      tapeStrip(ctx, theme, Math.round(fw * 0.34), 36, rngFor(env, 'tape'), paint(theme, 'tape'));
      ctx.restore();
    }
    ctx.restore();
  },
};

function paintPolaroid(c, env, img, src, d) {
  const { theme } = env, { pw, ph, side, bt, fw, fh, Q, look, cap } = d, sd = hashStr(String(src)) | 0;
  const white = rgb(theme, 'white'), paper = rgb(theme, 'paper'), ink = rgb(theme, 'ink');
  const F = env.createCanvas(fw, fh), g = F.getContext('2d');
  g.fillStyle = `rgb(${white.map((v, i) => Math.round(v * 0.6 + paper[i] * 0.4)).join(',')})`;
  rrect(g, 0, 0, fw, fh, 4); g.fill();
  edit(g, fw, fh, (p, i, x, y) => {
    if (!p[i + 3]) return;
    const n = (grain(x, y, sd + 7) - 0.5) * 8;
    p[i] += n; p[i + 1] += n; p[i + 2] += n;
  });
  const P = env.createCanvas(pw, ph), pg = P.getContext('2d');
  drawCover(pg, env, img, src, pw, ph);
  gradePhoto(pg, pw, ph, env, look, sd);
  g.drawImage(P, side, side);
  g.strokeStyle = `rgba(${ink[0]},${ink[1]},${ink[2]},0.3)`; g.lineWidth = 2; g.strokeRect(side, side, pw, ph);
  if (cap) {
    let size = Math.round(bt * 0.34);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = paint(theme, 'inkSoft');
    for (; size > 14; size -= 2) { g.font = font(theme, 'typed', size, '400'); if (g.measureText(cap).width <= fw * 0.84) break; }
    g.font = font(theme, 'typed', size, '400');
    g.fillText(cap, fw / 2, side + ph + bt * 0.5, fw * 0.88);
  }
  placePiece(c, env, F, fw, fh, Q);
}
