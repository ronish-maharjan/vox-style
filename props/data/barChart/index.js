// props/data/barChart/index.js — paper-cut bar chart on a card. Usage: { "prop":"barChart", "slots":{ "title":"POPULATION", "data":[{"label":"1990","value":5.7},{"label":"1997","value":6.5}] }, "options":{ "unit":"M", "highlight":1 } }
import { paint, font, place, anim, num, margins, rngFor, clamp01, rrect } from 'vox-studio/kit/look.js';
import { dropShadow } from 'vox-studio/core/helpers.js';
import { outCubic, fmtNum, fitFont } from 'vox-studio/kit/shapes.js';

export default {
  meta: {
    name: 'barChart', category: 'data',
    use: 'Compare 2–6 values with paper-cut bars on a card; bars grow in and the numbers count up. Use "highlight" (0-based bar index) to make the point.',
    avoid: 'More than 8 bars, labels longer than about 10 characters, or mixed units. For a single number use bigNumber.',
    slots: { data: 'array', title: 'string?' },
    options: { horizontal: 'boolean?', unit: 'string?', highlight: 'number?', max: 'number?', decimals: 'number?', card: 'boolean?' },
    defaultDuration: 4, defaultSize: { w: 920, h: 700 }, space: 'world', depth: 0.45, enter: 0.7,
    example: {
      slots: { title: 'HONG KONG POPULATION', data: [{ label: '1980', value: 5.1 }, { label: '1990', value: 5.7 }, { label: '1997', value: 6.5 }, { label: '2010', value: 7 }] },
      options: { unit: 'M', highlight: 2 },
    },
  },

  draw(ctx, o, env) {
    const { W, H, theme } = env;
    const { a, x } = anim(o);
    const vis = clamp01(a * 4) * (1 - x);
    if (vis <= 0.001) return;
    const items = (Array.isArray(o.data) ? o.data : [])
      .map((d) => ({ label: String(d?.label ?? ''), value: Number(d?.value), color: d?.color }))
      .filter((d) => Number.isFinite(d.value)).slice(0, 8);
    const n = items.length, horiz = o.horizontal === true, m = margins(env);
    const cw = Math.min(num(o.w, 920), W - m.left - m.right);
    const ch = num(o.h, horiz ? Math.max(420, 190 + n * 110) : 760);
    const pad = 44, s = outCubic(clamp01(a / 0.35)), g = clamp01((a - 0.15) / 0.85);
    const maxV = Math.max(num(o.max, 0), ...items.map((d) => d.value), 1e-9);
    const dec = o.decimals ?? (items.every((d) => Number.isInteger(d.value)) ? 0 : 1);
    const unit = o.unit ? String(o.unit) : '';
    const ink = paint(theme, 'ink'), soft = paint(theme, 'inkSoft');
    const st = 0.5 / Math.max(n, 1), span = 1 - st * (n - 1);
    const prog = (i) => outCubic(clamp01((g - i * st) / span));
    const hi = typeof o.highlight === 'number' ? o.highlight : -1;
    const colorOf = (i, it) => (it.color ? paint(theme, it.color) : hi < 0 ? paint(theme, 'accent2') : i === hi ? paint(theme, 'accent1') : paint(theme, 'kraft'));

    ctx.save();
    place(ctx, { ...o, x: num(o.x, W / 2), y: num(o.y, (m.top + H - m.bottom) / 2), rot: num(o.rot, -1), scale: num(o.scale, 1) * (0.96 + 0.04 * s) }, env);
    ctx.translate(0, (1 - s) * 70);
    ctx.globalAlpha *= vis;
    if (o.card !== false) dropShadow(ctx, theme, () => { ctx.fillStyle = paint(theme, 'white'); rrect(ctx, -cw / 2, -ch / 2, cw, ch, 8); ctx.fill(); }, {});

    let top = -ch / 2 + pad;
    if (o.title) {
      const ts = fitFont(ctx, theme, 'display', String(o.title), 56, '', cw - pad * 2, 28);
      ctx.fillStyle = ink; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(String(o.title), -cw / 2 + pad, top);
      top += ts * 1.3 + 8;
    }

    if (!horiz) {
      const yBase = ch / 2 - pad - 46, yTop = top + 60, areaH = Math.max(40, yBase - yTop);
      const inner = cw - pad * 2, gap = Math.min(28, inner * 0.04);
      const bw = Math.min(170, (inner - gap * (n - 1)) / Math.max(n, 1));
      const sx = -(bw * n + gap * (n - 1)) / 2;
      items.forEach((it, i) => {
        const p = prog(i), bx = sx + i * (bw + gap), bh = Math.max(0, areaH * (it.value / maxV)) * p, y0 = yBase - bh;
        const rng = rngFor(env, `bar${i}`), j1 = rng.range(-3, 3), j2 = rng.range(-3, 3);
        if (bh > 1) {
          dropShadow(ctx, theme, () => {
            ctx.fillStyle = colorOf(i, it); ctx.beginPath();
            ctx.moveTo(bx, yBase); ctx.lineTo(bx, y0 + j1); ctx.lineTo(bx + bw / 2, y0 - j1 * 0.5); ctx.lineTo(bx + bw, y0 + j2); ctx.lineTo(bx + bw, yBase);
            ctx.closePath(); ctx.fill();
          }, {});
          const txt = `${fmtNum(it.value * p, dec)}${unit}`;
          fitFont(ctx, theme, 'display', txt, 46, '', bw + gap, 20);
          ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
          ctx.fillText(txt, bx + bw / 2, y0 - 12);
        }
        fitFont(ctx, theme, 'text', it.label, 28, '600', bw + gap - 4, 14);
        ctx.fillStyle = soft; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(it.label, bx + bw / 2, yBase + 16);
      });
      ctx.strokeStyle = ink; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-cw / 2 + pad / 2, yBase); ctx.lineTo(cw / 2 - pad / 2, yBase); ctx.stroke();
    } else {
      const lw = 150, x0 = -cw / 2 + pad + lw + 14, xMax = cw / 2 - pad - 170, yTop = top + 6, yBot = ch / 2 - pad;
      const rh = (yBot - yTop) / Math.max(n, 1), bt = Math.min(72, rh * 0.62);
      items.forEach((it, i) => {
        const p = prog(i), cy = yTop + rh * i + rh / 2, len = Math.max(0, (xMax - x0) * (it.value / maxV)) * p;
        const rng = rngFor(env, `bar${i}`), j1 = rng.range(-3, 3), j2 = rng.range(-3, 3);
        if (len > 1) {
          dropShadow(ctx, theme, () => {
            ctx.fillStyle = colorOf(i, it); ctx.beginPath();
            ctx.moveTo(x0, cy - bt / 2); ctx.lineTo(x0 + len + j1, cy - bt / 2); ctx.lineTo(x0 + len - j1 * 0.5, cy); ctx.lineTo(x0 + len + j2, cy + bt / 2); ctx.lineTo(x0, cy + bt / 2);
            ctx.closePath(); ctx.fill();
          }, {});
          const txt = `${fmtNum(it.value * p, dec)}${unit}`;
          fitFont(ctx, theme, 'display', txt, 44, '', 160, 20);
          ctx.fillStyle = ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.fillText(txt, x0 + len + 16, cy + 2);
        }
        fitFont(ctx, theme, 'text', it.label, 30, '600', lw, 14);
        ctx.fillStyle = ink; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(it.label, x0 - 14, cy);
      });
      ctx.strokeStyle = ink; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x0, yTop); ctx.lineTo(x0, yBot); ctx.stroke();
    }
    ctx.restore();
  },
};
