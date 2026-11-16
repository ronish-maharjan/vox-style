// props/photos/paperPhoto/index.js — taped paper print of a real photo. Usage: { "prop":"paperPhoto", "slots":{ "src":"photos/a.jpg", "caption":"Victoria Harbour, 1997" } }
import { paint, font, place, cached, imageOf, anim, num, clamp01, rngFor, drawTape, toRGB, rrect } from 'vox-studio/kit/look.js';
import { dropShadow } from 'vox-studio/core/helpers.js';

export default {
  meta: {
    name: 'paperPhoto', category: 'photos',
    use: 'A real photo as a taped paper print with a soft shadow and a small tilt. The default way to show a person, place or object.',
    avoid: 'Screenshots full of text, or more than two photos on screen at once.',
    slots: { src: 'asset', caption: 'string?' },
    options: { look: 'enum:color|warm|bw|duotone', mount: 'enum:tape|none', border: 'number?' },
    defaultDuration: 3, defaultSize: { w: 780, h: 640 }, space: 'world', depth: 0.5,
    example: { slots: { src: 'assets/sample/skyline.png', caption: 'Sample skyline' }, options: { look: 'color', mount: 'tape' } },
  },

  draw(ctx, o, env) {
    const { W, H, theme } = env;
    const { a, x } = anim(o);
    const vis = clamp01(a * 2.2) * (1 - x);
    if (vis <= 0.001) return;
    const rng = rngFor(env, 'photo');
    const img = imageOf(env, o.src);
    const look = o.look ?? 'color';
    const bd = num(o.border, 26);
    const frameW = num(o.w, Math.min(W * 0.72, 780));
    const iw = Math.round(frameW - bd * 2);
    let ih = Math.round(o.h ? num(o.h, 400) - bd * 2 : iw / (img ? img.width / img.height : 4 / 3));
    ih = Math.min(ih, Math.round(H * 0.5));
    const strip = o.caption ? 70 : bd;
    const fw = iw + bd * 2, fh = ih + bd + strip;
    const tilt = num(o.rot, rng.range(-2.5, 2.5));
    const e = 1 - a;

    const spr = cached(env, `photo:${o.src}:${look}:${iw}x${ih}:${img ? 1 : 0}`, iw, ih, (c) => paintPhoto(c, img, iw, ih, look, o.src, env));

    ctx.save();
    place(ctx, { ...o, rot: tilt - e * 4, scale: num(o.scale, 1) * (0.94 + 0.06 * a) }, env);
    ctx.translate(0, e * 70);
    ctx.globalAlpha *= vis;
    dropShadow(ctx, theme, () => { ctx.fillStyle = paint(theme, 'white'); rrect(ctx, -fw / 2, -fh / 2, fw, fh, 4); ctx.fill(); }, {});
    ctx.drawImage(spr, -fw / 2 + bd, -fh / 2 + bd);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(-fw / 2 + bd, -fh / 2 + bd, iw, ih);

    if (o.caption) {
      let size = 32;
      ctx.font = font(theme, 'text', size, '600');
      while (size > 18 && ctx.measureText(o.caption).width > fw - bd * 2) { size -= 2; ctx.font = font(theme, 'text', size, '600'); }
      ctx.fillStyle = paint(theme, 'inkSoft'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(o.caption), 0, fh / 2 - strip / 2 + 4);
    }
    if ((o.mount ?? 'tape') === 'tape') {
      drawTape(ctx, theme, -fw / 2 + 56, -fh / 2 + 8, 150, 46, -34);
      drawTape(ctx, theme, fw / 2 - 56, -fh / 2 + 8, 150, 46, 34);
    }
    ctx.restore();
  },
};

function paintPhoto(c, img, w, h, look, src, env) {
  const { theme } = env;
  if (!img) {
    c.fillStyle = paint(theme, 'paperDark'); c.fillRect(0, 0, w, h);
    c.strokeStyle = paint(theme, 'inkSoft'); c.globalAlpha = 0.35; c.lineWidth = 2;
    for (let p = -h; p < w; p += 28) { c.beginPath(); c.moveTo(p, h); c.lineTo(p + h, 0); c.stroke(); }
    c.globalAlpha = 1; c.fillStyle = paint(theme, 'inkSoft'); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = font(theme, 'text', 28, '600');
    c.fillText(`missing: ${String(src ?? '').split('/').pop()}`, w / 2, h / 2);
    return;
  }
  const s = Math.max(w / img.width, h / img.height);
  c.drawImage(img, (w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s);
  if (look === 'warm') {
    c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.35; c.fillStyle = paint(theme, 'kraft'); c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  } else if (look === 'bw' || look === 'duotone') {
    const d = c.getImageData(0, 0, w, h), p = d.data;
    const lo = toRGB(paint(theme, 'ink')), mid = toRGB(paint(theme, 'accent2')), hi = toRGB(paint(theme, 'paper'));
    for (let i = 0; i < p.length; i += 4) {
      const l = (0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]) / 255;
      if (look === 'bw') { const v = l * 255; p[i] = p[i + 1] = p[i + 2] = v; continue; }
      const [A, B, t] = l < 0.5 ? [lo, mid, l * 2] : [mid, hi, (l - 0.5) * 2];
      p[i] = A[0] + (B[0] - A[0]) * t; p[i + 1] = A[1] + (B[1] - A[1]) * t; p[i + 2] = A[2] + (B[2] - A[2]) * t;
    }
    c.putImageData(d, 0, 0);
  }
}
