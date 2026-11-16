// props/documents/idCard/index.js — identity card or passport data page: header, photo, labelled rows that write on, seal, barcode or machine-readable lines, optional stamp. Usage: { "prop":"idCard", "slots":{ "name":"Chan Tai Man", "fields":["BORN | 12 MAR 1961","ISSUED | 3 MAY 1996"], "src":"person" }, "options":{ "kind":"id", "stamp":"EXPIRED" }, "at":"start" }
import { paint, font, num, cached, imageOf, rrect, rngFor, clamp01 } from 'vox-studio/kit/look.js';
import { fitFont, backOut, outCubic } from 'vox-studio/kit/shapes.js';
import { hashStr, dropShadow } from 'vox-studio/core/helpers.js';
import { gradePhoto, drawCover, enterState, stage } from 'vox-studio/kit/paper.js';
import { frame, fit } from 'vox-studio/kit/frame.js';
import { rgba } from 'vox-studio/kit/doc.js';

export default {
  meta: {
    name: 'idCard', category: 'documents',
    use: 'An identity card or a passport data page with a photo, a name and up to four "LABEL | value" rows that write on one by one. kind "id" has a coloured header band, "passport" is a paper page. Proof of who someone was or where they came from. Optional stamp such as EXPIRED. Without src it shows a grey silhouette. Sized from the safe area, so it fits 9:16 and 16:9.',
    avoid: 'More than four rows, long values (keep each under about 24 characters), or two cards on screen at once.',
    slots: { name: 'string', fields: 'array?', src: 'asset?' },
    options: { kind: 'enum:id|passport', title: 'string?', color: 'color?', stamp: 'string?' },
    defaultDuration: 5, defaultSize: { w: 720, h: 460 }, space: 'world', depth: 0.5, enter: 2.4,
    example: {
      slots: { name: 'Chan Tai Man', fields: ['BORN | 12 MAR 1961', 'PLACE | HONG KONG', 'ISSUED | 3 MAY 1996', 'NO. | K123456(7)'] },
      options: { kind: 'id', stamp: 'EXPIRED' },
    },
  },

  draw(ctx, o, env) {
    const { theme } = env, { a, vis } = enterState(o);
    if (vis <= 0.001) return;
    const F = frame(env), pass = o.kind === 'passport', r = pass ? 1.42 : 1.586;
    const bx = fit(r, F.w * 0.94, F.h * 0.9), w = num(o.w, bx.w), h = w / r;
    const title = String(o.title ?? (pass ? 'PASSPORT' : 'IDENTITY CARD')).toUpperCase().slice(0, 40);
    const rows = [{ label: 'NAME', value: String(o.name ?? '').toUpperCase(), big: true }, ...fieldRows(o.fields)];
    const n = rows.length, col = paint(theme, o.color, 'accent2'), ink = paint(theme, 'ink');
    const hz = h * 0.2, ph = h * 0.5, pw = ph * 0.8, px = -w / 2 + w * 0.05, py = -h / 2 + hz + h * 0.06;
    const fx = px + pw + w * 0.04, fr = w / 2 - w * 0.05, fw = fr - fx;
    const rowH = Math.min(h * 0.16, (h / 2 - h * (pass ? 0.21 : 0.15) - py) / n);
    const s = clamp01((a - 0.25) / 0.65), pa = outCubic(clamp01((a - 0.1) / 0.3)), tail = clamp01((a - 0.7) / 0.3);
    const img = o.src ? imageOf(env, o.src) : null, ppw = Math.round(pw), pph = Math.round(ph);
    const photo = cached(env, `idcard:${o.src ?? 'none'}:${img ? `${img.width}x${img.height}` : 'none'}:${ppw}x${pph}`, ppw, pph, (g) => {
      if (o.src) { drawCover(g, env, img, o.src, ppw, pph); gradePhoto(g, ppw, pph, env, 'bw', hashStr(String(o.src)) | 0); } else silhouette(g, theme, ppw, pph);
    });
    const body = () => { ctx.beginPath(); rrect(ctx, -w / 2, -h / 2, w, h, h * 0.05); };

    ctx.save();
    stage(ctx, env, o, a, 2.2);
    ctx.globalAlpha *= vis;
    dropShadow(ctx, theme, () => { body(); ctx.fillStyle = paint(theme, pass ? 'paperDark' : 'white'); ctx.fill(); }, {});
    ctx.save();
    body(); ctx.clip();

    ctx.save(); ctx.globalAlpha *= 0.09; ctx.strokeStyle = col; ctx.lineWidth = 2;
    for (let k = 0; k < 7; k++) {
      ctx.beginPath();
      for (let x = -w / 2; x <= w / 2; x += 14) {
        const y = -h / 2 + hz + (k * h * 0.8) / 6 + Math.sin(x * 0.02 + k * 0.9) * h * 0.025;
        if (x > -w / 2) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();

    const hc = pass ? col : paint(theme, 'white');
    ctx.fillStyle = col;
    if (pass) ctx.fillRect(-w / 2 + w * 0.05, -h / 2 + hz, w * 0.9, 2); else ctx.fillRect(-w / 2, -h / 2, w, hz);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    fitFont(ctx, theme, 'display', title, hz * 0.52, '400', w * 0.66, 12);
    ctx.fillStyle = hc; ctx.fillText(title, -w / 2 + w * 0.05, -h / 2 + hz / 2);
    ctx.strokeStyle = hc; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(w / 2 - w * 0.08, -h / 2 + hz / 2, hz * 0.3, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(w / 2 - w * 0.08, -h / 2 + hz / 2, hz * 0.12, 0, Math.PI * 2); ctx.fill();

    ctx.save(); ctx.globalAlpha *= pa;
    ctx.drawImage(photo, px, py);
    ctx.strokeStyle = rgba(theme, 'ink', 0.4); ctx.lineWidth = 2; ctx.strokeRect(px, py, pw, ph);
    ctx.restore();

    rows.forEach((rw, i) => {
      const p = clamp01(s * (n + 1) - i);
      if (p <= 0.001) return;
      const y = py + i * rowH;
      ctx.save(); ctx.beginPath(); ctx.rect(fx - 4, y - 2, (fw + 8) * p, rowH + 4); ctx.clip();
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.font = font(theme, 'text', Math.max(11, rowH * 0.24), '600'); ctx.fillStyle = paint(theme, 'inkSoft');
      if (rw.label) ctx.fillText(rw.label, fx, y + rowH * 0.2);
      if (rw.value) {
        if (rw.big) fitFont(ctx, theme, 'display', rw.value, rowH * 0.5, '400', fw, 12); else fitFont(ctx, theme, 'typed', rw.value, rowH * 0.4, '400', fw, 10);
        ctx.fillStyle = ink; ctx.fillText(rw.value, fx, y + rowH * 0.62);
      }
      ctx.globalAlpha *= 0.18; ctx.fillStyle = ink; ctx.fillRect(fx, y + rowH * 0.92, fw, 1.5);
      ctx.restore();
    });

    ctx.save(); ctx.globalAlpha *= tail; ctx.fillStyle = ink;
    if (pass) {
      const [l1, l2] = mrz(rngFor(env, 'mrz'), String(o.name ?? '').toUpperCase());
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      fitFont(ctx, theme, 'typed', l1, h * 0.055, '400', w * 0.86, 8);
      ctx.fillText(l1, -w / 2 + w * 0.05, h / 2 - h * 0.12); ctx.fillText(l2, -w / 2 + w * 0.05, h / 2 - h * 0.055);
    } else {
      const rb = rngFor(env, 'bars');
      for (let x = fx; x < fr - 4;) { const bw = rb.range(1.5, 5); ctx.fillRect(x, h / 2 - h * 0.13, bw, h * 0.07); x += bw + rb.range(1.5, 4); }
    }
    ctx.restore();

    ctx.save(); ctx.translate(px + pw * 0.98, py + ph * 0.95); ctx.rotate(-0.2);
    ctx.globalAlpha *= 0.35 * pa; ctx.strokeStyle = col; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, pw * 0.3, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, pw * 0.2, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 24; i++) {
      const t = (i / 24) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(Math.cos(t) * pw * 0.21, Math.sin(t) * pw * 0.21); ctx.lineTo(Math.cos(t) * pw * 0.29, Math.sin(t) * pw * 0.29); ctx.stroke();
    }
    ctx.restore();
    ctx.restore();

    ctx.strokeStyle = rgba(theme, 'ink', 0.25); ctx.lineWidth = 2; body(); ctx.stroke();

    if (o.stamp) {
      const sp = backOut(clamp01((a - 0.82) / 0.18));
      if (sp > 0.01) {
        const t = String(o.stamp).toUpperCase().slice(0, 24);
        let ss = h * 0.2;
        ctx.font = font(theme, 'display', ss);
        const mw = ctx.measureText(t).width;
        if (mw > w * 0.55) { ss *= (w * 0.55) / mw; ctx.font = font(theme, 'display', ss); }
        const bw = ctx.measureText(t).width + ss * 0.6, bh = ss * 1.35;
        ctx.save();
        ctx.translate(w * 0.16, h * 0.14); ctx.rotate(-0.22); ctx.scale(sp, sp);
        ctx.globalAlpha *= 0.88 * clamp01(sp * 2);
        ctx.strokeStyle = ctx.fillStyle = paint(theme, 'accent1'); ctx.lineWidth = Math.max(4, ss * 0.07);
        ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, 0, ss * 0.04);
        ctx.restore();
      }
    }
    ctx.restore();
  },
};

/** Up to 4 rows from "LABEL | value" strings or { label, value } objects. */
function fieldRows(f) {
  return (Array.isArray(f) ? f : []).slice(0, 4).map((it) => {
    if (it && typeof it === 'object') return { label: String(it.label ?? '').toUpperCase(), value: String(it.value ?? '').toUpperCase() };
    const s = String(it ?? ''), k = s.indexOf('|');
    return k < 0 ? { label: '', value: s.trim().toUpperCase() } : { label: s.slice(0, k).trim().toUpperCase(), value: s.slice(k + 1).trim().toUpperCase() };
  });
}

/** Two 36-character machine-readable lines (invented, seeded). */
function mrz(rng, name) {
  const pad = (s) => (s + '<'.repeat(36)).slice(0, 36), set = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<<';
  let l2 = '';
  for (let i = 0; i < 36; i++) l2 += set[Math.floor(rng.range(0, set.length - 0.001))];
  return [pad(`P<UTO${name.replace(/[^A-Z]+/g, '<')}`), l2];
}

/** Grey head-and-shoulders placeholder for a missing photo. */
function silhouette(g, theme, w, h) {
  g.fillStyle = paint(theme, 'paperDark'); g.fillRect(0, 0, w, h);
  g.fillStyle = paint(theme, 'inkSoft'); g.globalAlpha = 0.5;
  g.beginPath(); g.arc(w / 2, h * 0.38, w * 0.2, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(w / 2, h * 1.0, w * 0.42, h * 0.32, 0, 0, Math.PI * 2); g.fill();
  g.globalAlpha = 1;
}
