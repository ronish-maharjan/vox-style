// props/documents/newspaperClip/index.js — torn newspaper clipping. Usage: { "prop":"newspaperClip", "slots":{ "headline":"HONG KONG RETURNS TO CHINA", "body":"…", "source":"Morning Post · 1 July 1997" }, "options":{ "mark":"RETURNS" }, "at":"start" }
import { paint, font, place, anim, num, margins, rngFor, clamp01, drawTape } from 'vox-studio/kit/look.js';
import { dropShadow } from 'vox-studio/core/helpers.js';
import { tornPath, wrapText, highlightBar, fitFont, outCubic } from 'vox-studio/kit/shapes.js';

export default {
  meta: {
    name: 'newspaperClip', category: 'documents',
    use: 'A torn newspaper clipping with a serif headline and a few lines of body text. Proof that something was reported. Use "mark" to highlight a headline word.',
    avoid: 'Long articles (headline under 10 words, body under 35), two clippings at once, or leaving it on screen for more than about 4 s.',
    slots: { headline: 'string', body: 'string?', source: 'string?' },
    options: { mark: 'string?', filler: 'boolean?', tape: 'boolean?' },
    defaultDuration: 4, defaultSize: { w: 860, h: 640 }, space: 'world', depth: 0.5, enter: 0.9,
    example: {
      slots: { headline: 'HONG KONG RETURNS TO CHINA', body: 'After 156 years of British rule, the territory was handed over at midnight.', source: 'Morning Post · 1 July 1997' },
      options: { mark: 'RETURNS' },
    },
  },

  draw(ctx, o, env) {
    const { W, H, theme } = env;
    const { a, x } = anim(o);
    const vis = clamp01(a * 5) * (1 - x);
    if (vis <= 0.001) return;
    const m = margins(env), rng = rngFor(env, 'clip');
    const cw = Math.min(num(o.w, 860), W - m.left - m.right), pad = 44, inner = cw - pad * 2;
    const tilt = num(o.rot, rng.range(-2, 2));
    const head = String(o.headline ?? '').replace(/\s+/g, ' ').trim();
    const src = o.source ? String(o.source) : '';

    let hs = 64, hLines;
    do { ctx.font = font(theme, 'serif', hs, '700'); hLines = wrapText(ctx, head, inner, 4); hs -= 4; } while (hLines.length > 3 && hs >= 32);
    hs += 4;
    const hl = hs * 1.15, bl = 41, filler = o.filler !== false;
    ctx.font = font(theme, 'serif', 28);
    const bLines = o.body ? wrapText(ctx, String(o.body), inner, 6) : [];
    const ch = num(o.h, pad + (src ? 54 : 0) + hLines.length * hl + 26 + bLines.length * bl + (filler ? 96 : 0) + pad);
    const fillW = [rng.range(0.85, 1), rng.range(0.7, 0.95), rng.range(0.4, 0.7)];

    const s = outCubic(clamp01(a / 0.4)), mp = outCubic(clamp01((a - 0.45) / 0.55));
    ctx.save();
    place(ctx, { ...o, x: num(o.x, W / 2), y: num(o.y, (m.top + H - m.bottom) / 2), rot: tilt - (1 - s) * 3, scale: num(o.scale, 1) * (0.95 + 0.05 * s) }, env);
    ctx.translate(0, (1 - s) * 90);
    ctx.globalAlpha *= vis;

    dropShadow(ctx, theme, () => { ctx.fillStyle = paint(theme, 'paperDark'); tornPath(ctx, cw, ch, rngFor(env, 'tear'), 5, 26); ctx.fill(); }, {});
    ctx.fillStyle = 'rgba(255,253,248,0.35)';
    ctx.fillRect(-cw / 2 + 8, -ch / 2 + 8, cw - 16, ch - 16);

    const ink = paint(theme, 'ink'), L = -cw / 2 + pad;
    let y = -ch / 2 + pad;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    if (src) {
      fitFont(ctx, theme, 'serif', src, 24, 'italic', inner, 14);
      ctx.fillStyle = paint(theme, 'inkSoft'); ctx.fillText(src, L, y + 12); y += 34;
      ctx.fillStyle = ink; ctx.fillRect(L, y, inner, 4); ctx.fillRect(L, y + 9, inner, 1.5); y += 20;
    }
    const headTop = y;
    ctx.font = font(theme, 'serif', hs, '700'); ctx.fillStyle = ink;
    hLines.forEach((ln, i) => ctx.fillText(ln, L, headTop + i * hl + hl / 2));
    y += hLines.length * hl;
    ctx.fillStyle = ink; ctx.fillRect(L, y + 8, inner, 2); y += 26;

    ctx.font = font(theme, 'serif', 28); ctx.fillStyle = paint(theme, 'inkSoft');
    bLines.forEach((ln, i) => ctx.fillText(ln, L, y + i * bl + bl / 2));
    y += bLines.length * bl;
    if (filler) {
      ctx.fillStyle = 'rgba(27,26,23,0.16)';
      fillW.forEach((f, i) => ctx.fillRect(L, y + 10 + i * 30, inner * f, 12));
    }

    const mk = String(o.mark ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    const at = mk ? head.toLowerCase().indexOf(mk) : -1;
    if (at >= 0 && mp > 0) {
      ctx.font = font(theme, 'serif', hs, '700');
      let off = 0;
      hLines.forEach((ln, i) => {
        const s0 = off, e0 = off + ln.length;
        off = e0 + 1;
        const a0 = Math.max(s0, at), b0 = Math.min(e0, at + mk.length);
        if (b0 <= a0) return;
        const px = ctx.measureText(ln.slice(0, a0 - s0)).width, wd = ctx.measureText(ln.slice(a0 - s0, b0 - s0)).width;
        ctx.save();
        ctx.translate(L + px + wd / 2, headTop + i * hl + hl / 2 + hs * 0.04);
        highlightBar(ctx, wd + 12, hl * 0.82, mp, rngFor(env, `mark${i}`), paint(theme, 'highlight'));
        ctx.restore();
      });
    }
    if (o.tape !== false) {
      drawTape(ctx, theme, -cw / 2 + 70, -ch / 2 + 4, 140, 44, -32);
      drawTape(ctx, theme, cw / 2 - 70, -ch / 2 + 4, 140, 44, 32);
    }
    ctx.restore();
  },
};
