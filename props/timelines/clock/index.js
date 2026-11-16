// props/timelines/clock/index.js — hand-drawn paper clock: the ring draws, then the hands sweep to a time. Usage: { "prop":"clock", "slots":{ "time":"23:59" }, "options":{ "digital":true } }
import { paint, font, num, clamp01, margins, rngFor } from 'vox-studio/kit/look.js';
import { dropShadow } from 'vox-studio/core/helpers.js';
import { outCubic } from 'vox-studio/kit/shapes.js';
import { clamp, wobble, strokePts, ellipsePts } from 'vox-studio/kit/marks.js';
import { stage, enterState } from 'vox-studio/kit/paper.js';

/** "23:59", "11.59", "11:59 pm" to { h, m } or null. */
function parseTime(v) {
  const t = /^\s*(\d{1,2})[:.](\d{2})\s*([ap]m)?\s*$/i.exec(String(v ?? ''));
  if (!t) return null;
  let h = +t[1];
  const mi = +t[2], ap = (t[3] || '').toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return h < 24 && mi < 60 ? { h, m: mi } : null;
}

export default {
  meta: {
    name: 'clock', category: 'timelines',
    use: 'A paper clock face whose hands sweep round to a given time, with a typed digital readout. For "at 23:59", "one minute to midnight", deadlines and countdowns. Give time as "HH:MM" (24 h) or "11:59 pm".',
    avoid: 'Showing the passing of years (use timeline), or more than one clock at once.',
    slots: { time: 'string' },
    options: { digital: 'boolean?', color: 'color?' },
    defaultDuration: 3.5, space: 'world', depth: 0.5, enter: 1.4,
    example: { slots: { time: '23:59' }, options: { digital: true, color: 'accent1' } },
  },

  draw(ctx, o, env) {
    const { W, H, theme } = env, { a, vis } = enterState(o);
    if (vis <= 0.001) return;
    const m = margins(env), t = parseTime(o.time) ?? { h: 0, m: 0 }, digital = o.digital !== false;
    const availW = W - m.left - m.right - 40, availH = H - m.top - m.bottom - 40;
    const dsz = digital ? Math.round(clamp(availH * 0.09, 36, 70)) : 0, extra = digital ? dsz + 28 : 0;
    const r = Math.round(clamp(num(o.w, W > H ? 440 : 520), 160, Math.max(160, Math.min(availW, availH - extra))) / 2);
    const col = paint(theme, o.color, 'accent1'), ink = paint(theme, 'ink');
    const sw = outCubic(clamp01((a - 0.3) / 0.7));
    const ring = wobble(ellipsePts(r * 0.95, r * 0.95, 60, -Math.PI / 2, Math.PI * 2.05), rngFor(env, 'clock'), 2.5);

    ctx.save();
    stage(ctx, env, o, a, 2);
    ctx.translate(0, -extra / 2);
    ctx.globalAlpha *= vis;
    dropShadow(ctx, theme, () => { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = paint(theme, 'white'); ctx.fill(); }, {});
    strokePts(ctx, ring, ink, 12, a / 0.4);

    ctx.save();
    ctx.globalAlpha *= clamp01((a - 0.2) / 0.3);
    ctx.strokeStyle = ink; ctx.lineCap = 'butt';
    for (let i = 0; i < 60; i++) {
      const ang = (i / 60) * Math.PI * 2, big = i % 5 === 0, r0 = r * 0.84, r1 = r0 - r * (big ? 0.1 : 0.045);
      ctx.lineWidth = big ? 7 : 3; ctx.beginPath();
      ctx.moveTo(Math.sin(ang) * r0, -Math.cos(ang) * r0); ctx.lineTo(Math.sin(ang) * r1, -Math.cos(ang) * r1); ctx.stroke();
    }
    ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = font(theme, 'display', Math.round(r * 0.26), '400');
    [['12', 0], ['3', 90], ['6', 180], ['9', 270]].forEach(([s, deg]) => {
      const q = (deg * Math.PI) / 180;
      ctx.fillText(s, Math.sin(q) * r * 0.56, -Math.cos(q) * r * 0.56 + r * 0.01);
    });
    ctx.restore();

    const hand = (ang, len, w) => {
      const dx = Math.sin(ang), dy = -Math.cos(ang);
      ctx.lineCap = 'round'; ctx.lineWidth = w;
      ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath();
      ctx.moveTo(-dx * len * 0.14 + 3, -dy * len * 0.14 + 5); ctx.lineTo(dx * len + 3, dy * len + 5); ctx.stroke();
      ctx.strokeStyle = ink; ctx.beginPath();
      ctx.moveTo(-dx * len * 0.14, -dy * len * 0.14); ctx.lineTo(dx * len, dy * len); ctx.stroke();
    };
    hand((((t.h % 12) + t.m / 60) / 12) * Math.PI * 2 * sw, r * 0.42, r * 0.05);
    hand((t.m / 60 + 1) * Math.PI * 2 * sw, r * 0.64, r * 0.034);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.05, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = ink; ctx.stroke();

    if (digital) {
      ctx.globalAlpha *= clamp01((a - 0.7) / 0.3);
      ctx.font = font(theme, 'typed', dsz, '400'); ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${String(t.h).padStart(2, '0')}:${String(t.m).padStart(2, '0')}`, 0, r + 14 + dsz / 2);
    }
    ctx.restore();
  },
};
