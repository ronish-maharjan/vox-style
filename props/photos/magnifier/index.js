// props/photos/magnifier/index.js — photo print with a brass magnifying glass that zooms into one spot and can slide to a second. Usage: { "prop":"magnifier", "slots":{ "src":"scene" }, "options":{ "focus":[0.3,0.4], "to":[0.7,0.6], "zoom":2.4 }, "at":"start" }
import { paint, num, cached, imageOf, rrect, clamp01 } from 'vox-studio/kit/look.js';
import { outCubic, inOutCubic } from 'vox-studio/kit/shapes.js';
import { hashStr, dropShadow } from 'vox-studio/core/helpers.js';
import { LOOKS, clamp, gradePhoto, drawCover, placePiece, stage, enterState } from 'vox-studio/kit/paper.js';
import { frame, fit } from 'vox-studio/kit/frame.js';
import { rgba } from 'vox-studio/kit/doc.js';

export default {
  meta: {
    name: 'magnifier', category: 'photos',
    use: 'A photo print with a brass magnifying glass over it. The lens zooms into one spot (focus) and can slide to a second spot (to): finding a detail, a face in a crowd, a sign on a wall. focus and to are [x,y] inside the photo, 0 to 1. Sized from the safe area, so it fits 9:16 and 16:9.',
    avoid: 'Photos with nothing worth zooming into, zoom above about 3.5 on a small image, or more than two spots in one shot (use two shots instead).',
    slots: { src: 'asset' },
    options: { focus: 'array?', to: 'array?', zoom: 'number?', look: 'enum:bw|muted|color|halftone' },
    defaultDuration: 5, defaultSize: { w: 860, h: 700 }, space: 'world', depth: 0.5, enter: 2.6,
    example: { slots: { src: 'assets/sample/skyline.png' }, options: { focus: [0.3, 0.4], to: [0.7, 0.6], zoom: 2.4, look: 'bw' } },
  },

  draw(ctx, o, env) {
    const { theme } = env, { a, vis } = enterState(o);
    if (vis <= 0.001) return;
    const F = frame(env), img = o.src ? imageOf(env, o.src) : null, look = LOOKS[o.look] ? o.look : 'bw';
    const ratio = clamp(img ? img.width / img.height : 1.5, 0.75, 1.8);
    const bx = fit(ratio, F.w * 0.9, F.h * 0.9), pw = Math.round(num(o.w, bx.w)), ph = Math.round(pw / ratio);
    const bd = Math.round(pw * 0.03), fw = pw + 2 * bd, fh = ph + 2 * bd, Q = 46, sw = fw + 2 * Q, sh = fh + 2 * Q;
    const hw = Math.min(1800, pw * 2), hh = Math.round(hw / ratio), sd = hashStr(String(o.src)) | 0;
    const key = `magnifier:${o.src}:${img ? `${img.width}x${img.height}` : 'none'}:${look}:${pw}x${ph}`;
    const hi = cached(env, `${key}:hi`, hw, hh, (g) => { drawCover(g, env, img, o.src, hw, hh); gradePhoto(g, hw, hh, env, look, sd); });
    const print = cached(env, `${key}:print`, sw, sh, (c) => {
      const P = env.createCanvas(fw, fh), g = P.getContext('2d');
      g.fillStyle = paint(theme, 'white'); rrect(g, 0, 0, fw, fh, 3); g.fill();
      g.drawImage(hi, bd, bd, pw, ph);
      g.strokeStyle = rgba(theme, 'ink', 0.3); g.lineWidth = 2; g.strokeRect(bd, bd, pw, ph);
      placePiece(c, env, P, fw, fh, Q);
    });

    const R = Math.round(Math.min(pw, ph) * 0.31), Z = clamp(num(o.zoom, 2.2), 1.3, 4);
    const f0 = pt(o.focus, [0.5, 0.5]), f1 = o.to ? pt(o.to, f0) : f0;
    const lensIn = outCubic(clamp01((a - 0.3) / 0.3)), slide = inOutCubic(clamp01((a - 0.5) / 0.5));
    const zoom = 1 + (Z - 1) * outCubic(clamp01((a - 0.4) / 0.4)), t = num(env.t, 0);
    const lx = (f0[0] + (f1[0] - f0[0]) * slide - 0.5) * pw + Math.sin(t * 1.3) * 3;
    const ly = (f0[1] + (f1[1] - f0[1]) * slide - 0.5) * ph + Math.cos(t * 1.1) * 3;
    const ang = Math.atan2(f0[1] > 0.5 ? -1 : 1, f0[0] > 0.5 ? -1 : 1);

    ctx.save();
    stage(ctx, env, o, a, 2);
    ctx.globalAlpha *= vis;
    ctx.drawImage(print, -sw / 2, -sh / 2);
    glass(ctx, env, { hi, k: hw / pw, pw, ph, lx, ly, R, zoom, ang, p: lensIn });
    ctx.restore();
  },
};

/** [x,y] in 0..1 from an option, kept away from the very edge. */
function pt(v, d) {
  if (!Array.isArray(v) || v.length < 2) return d;
  return [clamp(num(v[0], d[0]), 0.06, 0.94), clamp(num(v[1], d[1]), 0.06, 0.94)];
}

/** Brass lens at (lx,ly) in photo-centre coordinates: handle, glass showing the hi-res photo magnified, ring. */
function glass(ctx, env, d) {
  const { theme } = env, { hi, k, pw, ph, lx, ly, R, zoom, ang, p } = d;
  if (p <= 0.001) return;
  const half = (R / zoom) * k, TAU = Math.PI * 2;
  const cx = clamp((lx + pw / 2) * k, half, hi.width - half), cy = clamp((ly + ph / 2) * k, half, hi.height - half);
  ctx.save();
  ctx.globalAlpha *= p;
  ctx.translate(lx, ly); ctx.scale(1.2 - 0.2 * p, 1.2 - 0.2 * p); ctx.translate(-lx, -ly);

  ctx.save(); ctx.translate(lx, ly); ctx.rotate(ang);
  dropShadow(ctx, theme, () => {
    ctx.fillStyle = paint(theme, 'ink'); ctx.beginPath(); rrect(ctx, R, -R * 0.1, R * 0.95, R * 0.2, R * 0.08); ctx.fill();
    ctx.fillStyle = paint(theme, 'kraft'); ctx.beginPath(); rrect(ctx, R * 0.98, -R * 0.14, R * 0.2, R * 0.28, R * 0.04); ctx.fill();
  }, {});
  ctx.restore();

  dropShadow(ctx, theme, () => { ctx.beginPath(); ctx.arc(lx, ly, R * 1.05, 0, TAU); ctx.fillStyle = paint(theme, 'white'); ctx.fill(); }, {});
  ctx.save();
  ctx.beginPath(); ctx.arc(lx, ly, R, 0, TAU); ctx.clip();
  ctx.drawImage(hi, cx - half, cy - half, half * 2, half * 2, lx - R, ly - R, R * 2, R * 2);
  const vg = ctx.createRadialGradient(lx, ly, R * 0.55, lx, ly, R);
  vg.addColorStop(0, rgba(theme, 'ink', 0)); vg.addColorStop(1, rgba(theme, 'ink', 0.28));
  ctx.fillStyle = vg; ctx.fillRect(lx - R, ly - R, R * 2, R * 2);
  ctx.restore();

  ctx.lineCap = 'round';
  ctx.strokeStyle = paint(theme, 'kraft'); ctx.lineWidth = R * 0.13;
  ctx.beginPath(); ctx.arc(lx, ly, R * 1.04, 0, TAU); ctx.stroke();
  ctx.strokeStyle = rgba(theme, 'white', 0.4); ctx.lineWidth = R * 0.04;
  ctx.beginPath(); ctx.arc(lx, ly, R * 1.01, Math.PI * 1.05, Math.PI * 1.6); ctx.stroke();
  ctx.strokeStyle = rgba(theme, 'ink', 0.55); ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(lx, ly, R * 1.105, 0, TAU); ctx.stroke();
  ctx.strokeStyle = rgba(theme, 'ink', 0.45); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(lx, ly, R * 0.975, 0, TAU); ctx.stroke();
  ctx.strokeStyle = rgba(theme, 'white', 0.55); ctx.lineWidth = R * 0.07;
  ctx.beginPath(); ctx.arc(lx, ly, R * 0.8, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
  ctx.restore();
}
