// props/annotations/stamp/index.js — rubber stamp that slams down. Usage: { "prop":"stamp", "slots":{ "text":"HANDOVER" }, "options":{ "rot":-10 }, "at":"word:stamp" }
import { paint, font, place, cached, anim, num, margins, clamp01 } from 'vox-studio/kit/look.js';
import { hashStr, seededRandom } from 'vox-studio/core/helpers.js';
import { backOut, fitFont } from 'vox-studio/kit/shapes.js';

export default {
  meta: {
    name: 'stamp', category: 'annotations',
    use: 'Slam a rubber-stamp word (APPROVED, CLASSIFIED, 1997) onto the page for a verdict or a punchline. Scales down with a small overshoot.',
    avoid: 'More than 3 words, more than one stamp at a time, or stamping before the thing it judges is on screen.',
    slots: { text: 'string' },
    options: { color: 'color?', shape: 'enum:box|round' },
    defaultDuration: 1.6, defaultSize: { w: 420, h: 220 }, space: 'world', depth: 0.7,
    example: { slots: { text: 'HANDOVER' }, options: { shape: 'box' } },
  },

  draw(ctx, o, env) {
    const { W, H, theme } = env;
    const { a, x } = anim(o);
    const vis = clamp01(a * 5) * (1 - x);
    if (vis <= 0.001) return;
    const text = String(o.text ?? '').trim().toUpperCase();
    if (!text) return;
    const m = margins(env), round = o.shape === 'round', col = paint(theme, o.color, 'accent1');
    const fs = fitFont(ctx, theme, 'display', text, 150, '', (W - m.left - m.right) * 0.8 - (round ? 170 : 100), 40);
    const tw = ctx.measureText(text).width;
    const bw = Math.round(round ? tw + 150 : tw + 100), bh = Math.round(round ? bw : fs * 1.15 + 60);
    const sw = bw + 40, sh = bh + 40;
    const spr = cached(env, `stamp:${text}:${col}:${round ? 1 : 0}:${fs}`, sw, sh, (c) => paintStamp(c, sw, sh, { text, col, round, fs, bw, bh, theme }));
    const sc = 1 + 1.3 * (1 - backOut(a, 1.1));

    ctx.save();
    place(ctx, { ...o, x: num(o.x, W / 2), y: num(o.y, (m.top + H - m.bottom) / 2), rot: num(o.rot, -8), scale: num(o.scale, 1) * sc }, env);
    ctx.globalAlpha *= vis;
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(spr, -sw / 2, -sh / 2);
    ctx.restore();
  },
};

function paintStamp(c, sw, sh, { text, col, round, fs, bw, bh, theme }) {
  const rng = seededRandom(hashStr(`stamp:${text}:${bw}`));
  c.translate(sw / 2, sh / 2);
  c.strokeStyle = col; c.fillStyle = col; c.lineJoin = 'round';
  c.lineWidth = 14;
  if (round) { c.beginPath(); c.arc(0, 0, bw / 2, 0, Math.PI * 2); c.stroke(); } else c.strokeRect(-bw / 2, -bh / 2, bw, bh);
  c.lineWidth = 5;
  if (round) { c.beginPath(); c.arc(0, 0, bw / 2 - 24, 0, Math.PI * 2); c.stroke(); } else c.strokeRect(-bw / 2 + 22, -bh / 2 + 22, bw - 44, bh - 44);
  c.font = font(theme, 'display', fs); c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, 0, fs * 0.04);
  // worn-ink grunge: punch specks and scratches out of the print
  c.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 260; i++) {
    c.globalAlpha = rng.range(0.35, 0.9);
    c.beginPath(); c.arc(rng.range(-sw / 2, sw / 2), rng.range(-sh / 2, sh / 2), rng.range(0.8, 3.6), 0, Math.PI * 2); c.fill();
  }
  c.strokeStyle = '#000';
  for (let i = 0; i < 6; i++) {
    c.globalAlpha = rng.range(0.3, 0.7); c.lineWidth = rng.range(1, 2.5);
    const px = rng.range(-sw / 2, sw / 2), py = rng.range(-sh / 2, sh / 2), ang = rng.range(0, Math.PI), len = rng.range(30, 120);
    c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.cos(ang) * len, py + Math.sin(ang) * len); c.stroke();
  }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
}
