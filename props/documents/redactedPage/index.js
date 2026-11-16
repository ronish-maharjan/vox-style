// props/documents/redactedPage/index.js — typed memo page; chosen words are blacked out by marker bars that sweep on (or lift off). Usage: { "prop":"redactedPage", "slots":{ "title":"MEMORANDUM", "text":"On 3 May Jon Smith signed the order." }, "options":{ "redact":["Jon Smith","3 May"], "stamp":"CONFIDENTIAL" }, "at":"start" }
import { paint, font, rngFor, clamp01 } from 'vox-studio/kit/look.js';
import { outCubic, backOut, fitFont } from 'vox-studio/kit/shapes.js';
import { enterState, stage } from 'vox-studio/kit/paper.js';
import { sheetBox, drawSheet, tokens, fitText } from 'vox-studio/kit/doc.js';

export default {
  meta: {
    name: 'redactedPage', category: 'documents',
    use: 'A typed memo page where chosen words are blacked out with marker bars: proof of secrecy or censorship. List the words to hide in "redact". "reveal" starts covered and lifts the bars. Optional red stamp. Sized from the safe area, so it fits 9:16 and 16:9.',
    avoid: 'More than about 60 words, redacting most of the text (it reads as a black block), or two pages on screen at once.',
    slots: { text: 'string', title: 'string?' },
    options: { redact: 'array?', stamp: 'string?', reveal: 'boolean?' },
    defaultDuration: 5, defaultSize: { w: 820, h: 1000 }, space: 'world', depth: 0.5, enter: 2.4,
    example: {
      slots: { title: 'MEMORANDUM', text: 'On 3 May the minister Jon Smith signed the order to move the files out of the colony before the handover.' },
      options: { redact: ['Jon Smith', '3 May'], stamp: 'CONFIDENTIAL' },
    },
  },

  draw(ctx, o, env) {
    const { theme } = env, { a, vis } = enterState(o);
    if (vis <= 0.001) return;
    const box = sheetBox(env, o), w = box.w, pad = w * 0.075, inner = w - pad * 2;
    const toks = tokens(o.text), list = Array.isArray(o.redact) ? o.redact : o.redact ? [o.redact] : [];
    mark(toks, list);
    const title = o.title ? String(o.title).toUpperCase() : '', ts = Math.round(w * 0.06);
    const top = pad + (title ? ts * 2.2 : 0);
    const body = fitText(ctx, theme, 'typed', undefined, toks, inner, box.h - top - pad, w * 0.042, w * 0.024, 1.55);
    const h = Math.min(box.h, Math.max(top + body.lines.length * body.lh + pad * 1.3, box.h * 0.55));
    const ink = paint(theme, 'ink'), L = -w / 2 + pad, y0 = -h / 2 + top;

    ctx.save();
    stage(ctx, env, o, a, 1.6);
    ctx.globalAlpha *= vis;
    drawSheet(ctx, env, w, h, { tone: 'white' });
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = ink;
    if (title) {
      fitFont(ctx, theme, 'typed', title, ts, '400', inner, 14);
      ctx.fillText(title, L, -h / 2 + pad + ts * 0.5);
      ctx.fillRect(L, -h / 2 + pad + ts * 1.4, inner, 3);
    }
    ctx.font = font(theme, 'typed', body.size);
    const runs = [];
    body.lines.forEach((ln, i) => {
      let cur = null;
      ln.forEach((wd) => {
        ctx.fillText(wd.t, L + wd.x, y0 + i * body.lh + body.lh / 2);
        if (!wd.red) { cur = null; return; }
        if (!cur) { cur = { i, x0: wd.x, x1: wd.x + wd.w }; runs.push(cur); } else cur.x1 = wd.x + wd.w;
      });
    });

    const s = clamp01((a - 0.3) / 0.7), n = runs.length, bh = body.size * 1.2;
    runs.forEach((r, k) => {
      let p = outCubic(clamp01((s - (n > 1 ? (k / n) * 0.7 : 0)) / 0.3));
      if (o.reveal) p = 1 - p;
      if (p <= 0.001) return;
      const fw = r.x1 - r.x0 + 14, cy = y0 + r.i * body.lh + body.lh / 2, bx = L + r.x0 - 7, by = cy - bh / 2;
      const rr = rngFor(env, `bar${k}`), seg = Math.max(2, Math.round(fw / 48)), jt = () => rr.range(-1.6, 1.6);
      ctx.save();
      ctx.beginPath(); ctx.rect(o.reveal ? bx + fw * (1 - p) : bx, by - 6, fw * p + 1, bh + 12); ctx.clip();
      ctx.beginPath();
      for (let i = 0; i <= seg; i++) { const px = bx + (fw * i) / seg; if (i) ctx.lineTo(px, by + jt()); else ctx.moveTo(px, by + jt()); }
      for (let i = seg; i >= 0; i--) ctx.lineTo(bx + (fw * i) / seg, by + bh + jt());
      ctx.closePath(); ctx.fillStyle = ink; ctx.fill();
      ctx.globalAlpha *= 0.3; ctx.fillStyle = paint(theme, 'inkSoft'); ctx.fillRect(bx, by + bh * 0.2 + jt(), fw, 2);
      ctx.restore();
    });

    if (o.stamp) {
      const sp = backOut(clamp01((a - 0.82) / 0.18));
      if (sp > 0.01) {
        const t = String(o.stamp).toUpperCase();
        let ss = w * 0.11;
        ctx.font = font(theme, 'display', ss);
        const mw = ctx.measureText(t).width;
        if (mw > w * 0.72) { ss *= (w * 0.72) / mw; ctx.font = font(theme, 'display', ss); }
        const tw = ctx.measureText(t).width, bw = tw + ss * 0.6, bh2 = ss * 1.35;
        ctx.save();
        ctx.translate(w * 0.02, h * 0.1); ctx.rotate(-0.2); ctx.scale(sp, sp);
        ctx.globalAlpha *= 0.88 * clamp01(sp * 2);
        ctx.strokeStyle = ctx.fillStyle = paint(theme, 'accent1'); ctx.lineWidth = Math.max(4, ss * 0.07);
        ctx.strokeRect(-bw / 2, -bh2 / 2, bw, bh2);
        ctx.textAlign = 'center'; ctx.fillText(t, 0, ss * 0.04);
        ctx.restore();
      }
    }
    ctx.restore();
  },
};

/** Flag the tokens that belong to any phrase in list (case-insensitive, edge punctuation ignored, may span lines). */
function mark(toks, list) {
  const norm = (s) => s.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  const ws = toks.map((k) => (k.br ? null : norm(k.t)));
  for (const ph of list) {
    const p = String(ph).split(/\s+/).map(norm).filter(Boolean);
    if (!p.length) continue;
    for (let i = 0; i + p.length <= ws.length; i++) {
      if (p.every((q, j) => ws[i + j] === q)) for (let j = 0; j < p.length; j++) toks[i + j].red = true;
    }
  }
}
