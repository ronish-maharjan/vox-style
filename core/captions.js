// core/captions.js — word-synced caption chunks. Usage: chunks = buildChunks(timelineLines); drawCaptions(ctx, chunks, T, { theme })
// caps syntax: "|" splits chunks, "*word*" highlights (can span several words). No caps -> auto-chunked from text.
import { seg, easeOut, easeOutBack } from './easing.js';
import { fitText } from './helpers.js';
import { norm, tokenize, mapTokens } from './words.js';

export const PRE_ROLL = 0.05;   // chunk appears 50 ms before its first word
export const HOLD = 0.25;       // last chunk of a line lingers briefly

export function parseCaps(caps) {
  return String(caps).split('|').map((chunk) => {
    const toks = [];
    chunk.split('*').forEach((part, i) => tokenize(part).forEach((t) => toks.push({ text: t, em: i % 2 === 1 })));
    return toks;
  }).filter((c) => c.length);
}

export function autoChunks(text, max = 4) {
  const out = [];
  let cur = [];
  for (const t of tokenize(text)) {
    cur.push({ text: t, em: false });
    if (cur.length >= max || (cur.length >= 2 && /[,;:.!?—–]["')\]]*$/.test(t))) { out.push(cur); cur = []; }
  }
  if (cur.length) {
    if (cur.length === 1 && out.length && out[out.length - 1].length < 5) out[out.length - 1].push(...cur);
    else out.push(cur);
  }
  return out;
}

/** lines: timeline lines {id,text,caps,words:[{w,n,start,end}]} -> chunks [{line,tokens:[{text,em,start,end}],start,end}] */
export function buildChunks(lines) {
  const chunks = [];
  for (const L of lines) {
    if (L.caps === false || L.caps === '' || !L.words.length) continue;
    const groups = L.caps ? parseCaps(L.caps) : autoChunks(L.text);
    const flat = groups.flat();
    if (!flat.length) continue;
    const map = mapTokens(flat.map((t) => norm(t.text)), L.words.map((w) => w.n));
    let f = 0;
    for (const g of groups) {
      const tokens = g.map((t) => { const [lo, hi] = map[f++]; return { text: t.text, em: t.em, start: L.words[lo].start, end: L.words[hi].end }; });
      chunks.push({ line: L.id, tokens, start: tokens[0].start - PRE_ROLL, end: 0 });
    }
  }
  chunks.forEach((c, i) => {
    const n = chunks[i + 1], tail = c.tokens[c.tokens.length - 1].end + HOLD;
    c.end = n && n.line === c.line ? n.start : n ? Math.min(tail, n.start) : tail;
  });
  return chunks;
}

export const activeChunk = (chunks, T) => chunks.find((c) => T >= c.start && T < c.end) || null;

/** Screen-space (ignores camera). Sticker-style: paper-white outline, ink fill, highlighter wipe on *emphasised* words. */
export function drawCaptions(ctx, chunks, T, { theme }) {
  const c = activeChunk(chunks, T);
  if (!c) return;
  const f = theme.format, cfg = theme.captions, col = theme.colors, family = theme.fonts.display;
  const label = (s) => (cfg.upper ? s.toUpperCase() : s);
  const fit = fitText(ctx, c.tokens.map((k) => label(k.text)).join(' '), {
    maxW: f.caption.maxW, maxH: f.caption.size * f.caption.lines * 1.12 + 1,
    family, weight: '400', maxSize: f.caption.size, minSize: 30, lineHeight: 1.12,
  });
  fit.lines = fit.lines.slice(0, f.caption.lines); // #11 fix: when fitText cannot fit, cap at the line budget
  const lh = fit.size * fit.lineHeight;
  ctx.save();
  ctx.font = `400 ${fit.size}px ${family}`;
  const space = ctx.measureText(' ').width, items = [];
  let k = 0;
  fit.lines.forEach((line, li) => {
    const toks = line.split(' '), ws = toks.map((t) => ctx.measureText(t).width);
    let x = -(ws.reduce((a, b) => a + b, 0) + space * (toks.length - 1)) / 2;
    const y = (li + 0.5) * lh - (fit.lines.length * lh) / 2;
    toks.forEach((t, i) => { items.push({ t, x, y, w: ws[i], tok: c.tokens[k++] }); x += ws[i] + space; });
  });
  ctx.translate(f.W / 2, f.caption.y);
  const sc = 0.9 + 0.1 * easeOutBack(seg(T, c.start, c.start + 0.16));
  ctx.scale(sc, sc);
  ctx.globalAlpha = seg(T, c.start, c.start + 0.08);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  ctx.strokeStyle = col.white; ctx.lineWidth = fit.size * cfg.strokeRatio;
  for (const it of items) ctx.strokeText(it.t, it.x, it.y);
  for (const it of items) {
    const wipe = it.tok && it.tok.em ? seg(T, it.tok.start - 0.02, it.tok.start + 0.2) : 0;
    if (wipe > 0) { ctx.fillStyle = col.highlight; ctx.fillRect(it.x - 10, it.y - fit.size * 0.5, (it.w + 20) * easeOut(wipe), fit.size); }
  }
  ctx.fillStyle = col.ink;
  for (const it of items) ctx.fillText(it.t, it.x, it.y);
  ctx.restore();
}
