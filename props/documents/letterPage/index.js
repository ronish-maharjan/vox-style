// props/documents/letterPage/index.js — typeset letter on folded paper: date, body lines that write on one by one, signature. Usage: { "prop":"letterPage", "slots":{ "date":"12 March 1984", "text":"Dear Mr Chan,\n\nThe talks will continue.", "signature":"Margaret" }, "options":{ "paper":"aged" }, "at":"start" }
import { paint, font, num, rngFor, clamp01 } from 'vox-studio/kit/look.js';
import { enterState, stage } from 'vox-studio/kit/paper.js';
import { sheetBox, drawSheet, tokens, fitText, rgba } from 'vox-studio/kit/doc.js';

export default {
  meta: {
    name: 'letterPage', category: 'documents',
    use: 'A letter on folded paper: optional date, body text that writes on line by line, optional signature at the end. Proof that someone wrote or promised something. paper: plain, lined or aged. Sized from the safe area, so it fits 9:16 and 16:9.',
    avoid: 'More than about 70 words, two letters on screen at once, or a signature without a body.',
    slots: { text: 'string', date: 'string?', signature: 'string?' },
    options: { paper: 'enum:plain|lined|aged?', face: 'enum:serif|typed?', folds: 'number?' },
    defaultDuration: 6, defaultSize: { w: 820, h: 1000 }, space: 'world', depth: 0.5, enter: 3,
    example: {
      slots: { date: '12 March 1984', text: 'Dear Mr Chan,\n\nI write to confirm that the talks will continue through the winter.\n\nYours sincerely', signature: 'Margaret' },
      options: { paper: 'aged' },
    },
  },

  draw(ctx, o, env) {
    const { theme } = env, { a, vis } = enterState(o);
    if (vis <= 0.001) return;
    const pk = ['plain', 'lined', 'aged'].includes(o.paper) ? o.paper : 'plain', lined = pk === 'lined';
    const kind = o.face === 'typed' ? 'typed' : 'serif';
    const box = sheetBox(env, o), w = box.w, pad = w * 0.09, inner = w - pad * 2;
    const date = o.date ? String(o.date) : '', sig = o.signature ? String(o.signature) : '';
    const ds = w * 0.034, headH = date ? ds * 2.4 : 0, sigH = sig ? w * 0.13 : 0;
    const body = fitText(ctx, theme, kind, undefined, tokens(o.text), inner, box.h - pad * 2 - headH - sigH, w * 0.04, w * 0.024, lined ? 1.7 : 1.5);
    const nL = body.lines.length;
    const h = Math.min(box.h, Math.max(pad * 2 + headH + nL * body.lh + sigH, box.h * 0.6));
    const folds = Math.max(0, Math.min(3, Math.round(num(o.folds, lined ? 0 : 2))));
    const L = -w / 2 + pad, R = L + inner, top = -h / 2 + pad, y0 = top + headH, ink = paint(theme, 'ink');
    const s = clamp01((a - 0.25) / 0.75), units = (date ? 1 : 0) + nL + (sig ? 2 : 0);
    const prog = (u, n = 1) => clamp01((s * units - u) / n);
    const wipe = (x, y, ww, hh, p, fn) => {
      if (p <= 0.001) return;
      ctx.save(); ctx.beginPath(); ctx.rect(x - 4, y, (ww + 8) * p, hh); ctx.clip(); fn(); ctx.restore();
    };

    ctx.save();
    stage(ctx, env, o, a, 1.8);
    ctx.globalAlpha *= vis;
    drawSheet(ctx, env, w, h, { tone: pk === 'aged' ? 'paperDark' : 'white', aged: pk === 'aged', folds });
    if (lined) {
      ctx.fillStyle = rgba(theme, 'accent2', 0.25);
      for (let y = y0 + body.lh / 2 + body.size * 0.42; y < h / 2 - pad * 0.4; y += body.lh) ctx.fillRect(-w / 2 + pad * 0.5, y, w - pad, 2);
      ctx.fillStyle = rgba(theme, 'accent1', 0.3); ctx.fillRect(L - pad * 0.3, -h / 2 + 3, 2.5, h - 6);
    }
    ctx.fillStyle = ink; ctx.textBaseline = 'middle';
    if (date) {
      ctx.font = font(theme, kind, ds, kind === 'serif' ? 'italic' : undefined); ctx.textAlign = 'right';
      wipe(L, top, inner, ds * 1.6, prog(0), () => ctx.fillText(date, R, top + ds * 0.8));
    }
    ctx.font = font(theme, kind, body.size); ctx.textAlign = 'left';
    body.lines.forEach((ln, i) => {
      const cy = y0 + i * body.lh + body.lh / 2;
      wipe(L, cy - body.lh / 2, inner, body.lh, prog((date ? 1 : 0) + i), () => ln.forEach((wd) => ctx.fillText(wd.t, L + wd.x, cy)));
    });
    if (sig) {
      let ss = body.size * 1.6;
      ctx.font = font(theme, 'serif', ss, 'italic');
      const mw = ctx.measureText(sig).width;
      if (mw > inner * 0.6) { ss *= (inner * 0.6) / mw; ctx.font = font(theme, 'serif', ss, 'italic'); }
      const tw = ctx.measureText(sig).width;
      ctx.save();
      ctx.translate(R, y0 + nL * body.lh + sigH * 0.55); ctx.rotate(-0.05);
      wipe(-tw - 10, -ss, tw + 20, ss * 2, prog((date ? 1 : 0) + nL, 2), () => {
        ctx.textAlign = 'right'; ctx.fillText(sig, 0, 0);
        ctx.strokeStyle = ink; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-tw, ss * 0.6); ctx.quadraticCurveTo(-tw * 0.4, ss * 0.9, 6, ss * 0.45); ctx.stroke();
      });
      ctx.restore();
    }
    ctx.restore();
  },
};
