// props/collage/stickerCutout/index.js — photo cut out like paper: scissor-irregular off-white rim, paper thickness, two-layer shadow, desaturated/halftone photo, optional torn backing. Usage: { "prop":"stickerCutout", "slots":{ "src":"person" }, "options":{ "cut":"alpha", "look":"halftone" } }
import { paint, place, cached, imageOf, anim, num, clamp01, margins, rrect, rngFor } from 'vox-studio/kit/look.js';
import { dropShadow, hashStr, seededRandom } from 'vox-studio/core/helpers.js';
import { outCubic, tornPath } from 'vox-studio/kit/shapes.js';
import { LOOKS, clamp, paperRim, gradePhoto, missingBox } from 'vox-studio/kit/paper.js';

const CUTS = ['alpha', 'poly', 'oval', 'rect', 'torn', 'scissor'];
const BACKINGS = ['none', 'blob', 'circle', 'rect'];

export default {
  meta: {
    name: 'stickerCutout', category: 'collage',
    use: 'A person, place or object cut out of its photo like paper: irregular scissor-cut off-white rim, paper thickness, soft shadow, desaturated or halftone photo, optional torn backing. Best with a transparent PNG (cut "alpha"); use "scissor" for ordinary photos and "poly" to trace an outline.',
    avoid: 'More than two cutouts at once, a traced "poly" outline on hair or fine detail (supply a transparent PNG instead), or photos that need their whole frame (use paperPhoto or polaroid).',
    slots: { src: 'asset' },
    options: { cut: 'enum:alpha|poly|oval|rect|torn|scissor', points: 'array?', ratio: 'number?', rim: 'number?', rough: 'number?', look: 'enum:bw|muted|color|halftone', backing: 'enum:none|blob|circle|rect', backingColor: 'color?', flip: 'boolean?' },
    defaultDuration: 3.5, defaultSize: { w: 640, h: 640 }, space: 'world', depth: 0.5,
    example: { slots: { src: 'assets/sample/skyline.png' }, options: { cut: 'scissor', rim: 10, look: 'halftone' } },
  },

  draw(ctx, o, env) {
    const { W, H, theme } = env;
    const { a, x } = anim(o);
    const vis = clamp01(a * 3) * (1 - x);
    if (vis <= 0.001) return;
    const m = margins(env), img = imageOf(env, o.src);
    const want = CUTS.includes(o.cut) ? o.cut : 'alpha';
    const pts = want === 'poly' ? readPoints(o.points) : null;
    const cut = want === 'poly' && !pts ? 'rect' : want;
    const g = geom(o, img, cut, pts);
    const R = Math.round(clamp(num(o.rim, 10), 0, 40)), Q = Math.ceil(R * 1.8) + 46;
    const rough = clamp(num(o.rough, cut === 'rect' || cut === 'torn' ? 0.35 : 1), 0, 1);
    const look = LOOKS[o.look] ? o.look : 'bw', flip = !!o.flip;
    const back = BACKINGS.includes(o.backing) ? o.backing : 'none';
    const k = back === 'none' ? 1 : 1.2;
    const availW = (W - m.left - m.right) / k - 2 * R, availH = (H - m.top - m.bottom - 40) / k - 2 * R;
    let bw = o.w ? num(o.w, 600) : o.h ? num(o.h, 800) * g.ratio : W > H ? 520 : 640;
    bw = Math.max(60, Math.round(Math.min(bw, availW, availH * g.ratio)));
    const bh = Math.max(60, Math.round(bw / g.ratio)), sw = bw + 2 * Q, sh = bh + 2 * Q;
    const pk = pts ? pts.map((q) => q.map((v) => v.toFixed(3)).join(',')).join(';') : '';
    const key = `stickerCutout:${o.src}:${cut}:${img ? `${img.width}x${img.height}` : 'none'}:${pk}:${bw}x${bh}:${R}:${rough}:${look}:${flip}`;
    const spr = cached(env, key, sw, sh, (c) => paintCutout(c, env, img, o.src, { cut, pts, g, bw, bh, R, Q, rough, look, flip }));
    const s = outCubic(clamp01(a / 0.6)), e = 1 - s;
    const tilt = rngFor(env, 'tilt').range(-3, 3);

    ctx.save();
    place(ctx, { ...o, x: num(o.x, W / 2), y: num(o.y, (m.top + H - m.bottom) / 2), rot: num(o.rot, tilt) - e * 3, scale: num(o.scale, 1) * (0.9 + 0.1 * s) }, env);
    ctx.translate(0, e * 50);
    ctx.globalAlpha *= vis;
    if (back !== 'none') drawBacking(ctx, theme, back, paint(theme, o.backingColor, 'kraft'), `backing:${o.src}:${back}`, bw + 2 * R, bh + 2 * R, outCubic(clamp01(a / 0.8)));
    ctx.drawImage(spr, -sw / 2, -sh / 2);
    ctx.restore();
  },
};

function readPoints(v) {
  if (!Array.isArray(v)) return null;
  const out = [];
  for (const p of v.slice(0, 80)) {
    const px = Array.isArray(p) ? p[0] : p?.x, py = Array.isArray(p) ? p[1] : p?.y;
    if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
    out.push([clamp01(px), clamp01(py)]);
  }
  return out.length >= 3 ? out : null;
}

/** Crop rectangle (fractions of the image) and width/height ratio of the finished cutout. */
function geom(o, img, cut, pts) {
  const iw = img?.width || 800, ih = img?.height || 600;
  let f = [0, 0, 1, 1];
  if (pts) {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    if (x1 - x0 > 0.02 && y1 - y0 > 0.02) f = [x0, y0, x1 - x0, y1 - y0];
  }
  const natural = (f[2] * iw) / (f[3] * ih);
  const free = cut === 'alpha' || cut === 'poly';
  return { iw, ih, f, ratio: free ? natural : clamp(num(o.ratio, cut === 'oval' ? 1 : natural), 0.3, 3) };
}

function paintCutout(c, env, img, src, d) {
  const { bw, bh, R, Q, rough, look, flip } = d, sd = hashStr(String(src)) | 0;
  const S = env.createCanvas(bw, bh), sg = S.getContext('2d');
  if (flip) { sg.translate(bw, 0); sg.scale(-1, 1); }
  shapeImage(sg, env, img, src, d);
  paperRim(c, env, sg, { bw, bh, R, Q, rough, sd });
  gradePhoto(sg, bw, bh, env, look, sd);
  c.drawImage(S, Q, Q);
}

/** Irregular straight-edged polygon: a squarish superellipse with jittered angles and random inset. */
function scissorPath(g, w, h, rng) {
  const n = 18, sp = (v) => Math.sign(v) * Math.abs(v) ** 0.45;
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const t = ((i + rng.range(-0.3, 0.3)) / n) * Math.PI * 2, k = 1 - rng.range(0, 0.09);
    const px = w / 2 + sp(Math.cos(t)) * (w / 2) * k, py = h / 2 + sp(Math.sin(t)) * (h / 2) * k;
    if (i) g.lineTo(px, py); else g.moveTo(px, py);
  }
  g.closePath();
}

function shapeImage(sg, env, img, src, { cut, pts, g, bw, bh }) {
  const { theme } = env, cx = g.f[0] * g.iw, cy = g.f[1] * g.ih, cw = g.f[2] * g.iw, ch = g.f[3] * g.ih;
  sg.save();
  if (cut === 'oval') { sg.beginPath(); sg.ellipse(bw / 2, bh / 2, bw / 2, bh / 2, 0, 0, Math.PI * 2); sg.clip(); }
  else if (cut === 'rect') { rrect(sg, 0, 0, bw, bh, 8); sg.clip(); }
  else if (cut === 'scissor') { scissorPath(sg, bw, bh, seededRandom(hashStr(`scissor:${src}:${bw}x${bh}`))); sg.clip(); }
  else if (cut === 'torn') {
    sg.translate(bw / 2, bh / 2);
    tornPath(sg, bw, bh, seededRandom(hashStr(`cutout:${src}:${bw}x${bh}`)), theme.edge.tornAmp, theme.edge.tornStep);
    sg.clip(); sg.translate(-bw / 2, -bh / 2);
  } else if (cut === 'poly') {
    sg.beginPath();
    pts.forEach(([px, py], i) => {
      const qx = ((px * g.iw - cx) / cw) * bw, qy = ((py * g.ih - cy) / ch) * bh;
      if (i) sg.lineTo(qx, qy); else sg.moveTo(qx, qy);
    });
    sg.closePath(); sg.clip();
  }
  if (img) {
    const s = Math.max(bw / cw, bh / ch), sw = bw / s, sh = bh / s;
    sg.drawImage(img, cx + (cw - sw) / 2, cy + (ch - sh) / 2, sw, sh, 0, 0, bw, bh);
  } else missingBox(sg, theme, src, bw, bh);
  sg.restore();
}

/** Torn-paper backing: a ragged, straight-edged shape with a thin off-white torn edge. */
function drawBacking(ctx, theme, kind, col, seed, w, h, s) {
  const amp = theme.edge.tornAmp * 0.6, step = theme.edge.tornStep;
  const mk = () => seededRandom(hashStr(seed));
  const shape = (grow) => {
    if (kind === 'rect') {
      ctx.save(); ctx.rotate((-4 * Math.PI) / 180);
      tornPath(ctx, w * 1.1 + grow * 2, h * 1.06 + grow * 2, mk(), theme.edge.tornAmp, step);
      ctx.restore();
    } else if (kind === 'circle') {
      const r = Math.min(Math.max(w, h) * 0.51, w * 0.6) + grow;
      ragged(ctx, r, r, mk(), amp, step, 0);
    } else ragged(ctx, (w / 2) * 1.12 + grow, (h / 2) * 1.08 + grow, mk(), amp, step, 0.06);
  };
  ctx.save();
  ctx.translate(-w * 0.03, h * 0.04); ctx.scale(0.7 + 0.3 * s, 0.7 + 0.3 * s);
  dropShadow(ctx, theme, () => {
    shape(4); ctx.fillStyle = paint(theme, 'white'); ctx.fill();
    shape(0); ctx.fillStyle = col; ctx.fill();
  }, {});
  ctx.restore();
}

function ragged(ctx, rx, ry, rng, amp, step, lobes) {
  const n = Math.max(24, Math.round((Math.PI * (rx + ry)) / step));
  const p1 = rng.range(0, 6.28), p2 = rng.range(0, 6.28);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2, f = 1 + lobes * (Math.sin(2 * t + p1) + 0.6 * Math.sin(3 * t + p2)), j = rng.range(-amp, amp);
    const px = Math.cos(t) * (rx * f + j), py = Math.sin(t) * (ry * f + j);
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
}
