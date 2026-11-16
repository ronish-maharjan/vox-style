// props/maps/baseMap/index.js — paper-craft map with pins. Usage: { "prop":"baseMap", "slots":{ "focus":["Hong Kong"], "pins":[{"lon":114.17,"lat":22.32,"label":"Hong Kong"}] }, "options":{ "bbox":[111.5,21,116.5,24.8] } }
import geo from './geo-data.js';
import { paint, font, place, cached, anim, num, margins, clamp01, rrect } from 'vox-studio/kit/look.js';
import { dropShadow } from 'vox-studio/core/helpers.js';
import { outCubic, backOut } from 'vox-studio/kit/shapes.js';

const DEFAULT_BBOX = [95, 5, 135, 45];

export default {
  meta: {
    name: 'baseMap', category: 'maps',
    use: 'A cut-paper map of a region. "focus" colours named countries or territories; "pins" drop labelled pins (lon/lat). bbox is [west, south, east, north] in degrees.',
    avoid: 'Maps with more than 5 pins, world-scale maps (use a tight bbox), or relying on a name that is not in Natural Earth (a misspelt focus name simply highlights nothing).',
    slots: { pins: 'array?', focus: 'array?' },
    options: { bbox: 'array?', card: 'boolean?' },
    defaultDuration: 4, defaultSize: { w: 900, h: 1100 }, space: 'world', depth: 0.4, enter: 1,
    example: {
      slots: { focus: ['Hong Kong'], pins: [{ lon: 114.17, lat: 22.32, label: 'Hong Kong' }, { lon: 113.26, lat: 23.13, label: 'Guangzhou', side: 'left' }] },
      options: { bbox: [111.5, 21, 116.5, 24.8] },
    },
  },

  draw(ctx, o, env) {
    const { W, H, theme } = env;
    const { a, x } = anim(o);
    const vis = clamp01(a * 4) * (1 - x);
    if (vis <= 0.001) return;
    const m = margins(env), b = bboxOf(o);
    const k = Math.cos((((b[1] + b[3]) / 2) * Math.PI) / 180), ar = ((b[2] - b[0]) * k) / (b[3] - b[1]);
    const maxH = Math.max(200, H - m.top - m.bottom - 40);
    let w = Math.round(Math.min(num(o.w, W > H ? 1400 : 940), W - m.left - m.right));
    let h = Math.round(num(o.h, w / ar));
    if (!o.w && !o.h && h > maxH) { h = Math.round(maxH); w = Math.round(h * ar); }
    const pins = (Array.isArray(o.pins) ? o.pins : []).map((p) => ({
      lon: Number(p?.lon), lat: Number(p?.lat), label: p?.label ? String(p.label) : '', side: p?.side === 'left' ? 'left' : 'right', color: p?.color,
    })).filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat)).slice(0, 8);
    const focus = (Array.isArray(o.focus) ? o.focus : []).map((s) => String(s).toLowerCase());
    const spr = cached(env, `baseMap:${b.join(',')}:${w}x${h}:${focus.join('|')}:${geo.features.length}`, w, h, (c) => paintMap(c, w, h, b, focus, theme));
    const { project } = projection(b, w, h);
    const s = outCubic(clamp01(a / 0.35));

    ctx.save();
    place(ctx, { ...o, x: num(o.x, W / 2), y: num(o.y, (m.top + H - m.bottom) / 2), rot: num(o.rot, -1), scale: num(o.scale, 1) * (0.96 + 0.04 * s) }, env);
    ctx.translate(0, (1 - s) * 70);
    ctx.globalAlpha *= vis;
    dropShadow(ctx, theme, () => ctx.drawImage(spr, -w / 2, -h / 2), {});
    pins.forEach((p, i) => {
      const pp = clamp01((a - 0.3 - i * 0.12) / 0.3);
      const [px, py] = project(p.lon, p.lat);
      if (pp <= 0 || px < 0 || px > w || py < 0 || py > h) return;
      drawPin(ctx, theme, px - w / 2, py - h / 2, p, backOut(pp), pp);
    });
    ctx.restore();
  },
};

function bboxOf(o) {
  const b = o.bbox;
  return Array.isArray(b) && b.length === 4 && b.every(Number.isFinite) && b[2] > b[0] && b[3] > b[1] ? b : DEFAULT_BBOX;
}

function projection(b, w, h) {
  const k = Math.cos((((b[1] + b[3]) / 2) * Math.PI) / 180);
  const scale = Math.min(w / ((b[2] - b[0]) * k), h / (b[3] - b[1]));
  const cLon = (b[0] + b[2]) / 2, cLat = (b[1] + b[3]) / 2;
  return { project: (lon, lat) => [(lon - cLon) * k * scale + w / 2, (cLat - lat) * scale + h / 2] };
}

function paintMap(c, w, h, b, focus, theme) {
  const { project } = projection(b, w, h);
  c.save();
  rrect(c, 0, 0, w, h, 10); c.clip();
  c.fillStyle = paint(theme, 'white'); c.fillRect(0, 0, w, h);
  c.globalAlpha = 0.16; c.fillStyle = paint(theme, 'accent2'); c.fillRect(0, 0, w, h);
  const spanDeg = b[2] - b[0], step = spanDeg <= 8 ? 1 : spanDeg <= 30 ? 5 : 10;
  c.globalAlpha = 0.1; c.strokeStyle = paint(theme, 'ink'); c.lineWidth = 1.5;
  for (let lon = Math.ceil(b[0] / step) * step; lon <= b[2]; lon += step) { const [px] = project(lon, b[1]); c.beginPath(); c.moveTo(px, 0); c.lineTo(px, h); c.stroke(); }
  for (let lat = Math.ceil(b[1] / step) * step; lat <= b[3]; lat += step) { const [, py] = project(b[0], lat); c.beginPath(); c.moveTo(0, py); c.lineTo(w, py); c.stroke(); }
  c.globalAlpha = 1;

  if (!geo.features.length) {
    c.fillStyle = paint(theme, 'inkSoft'); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = font(theme, 'text', 30, '600');
    c.fillText('map data missing — run: npm run setup:geo', w / 2, h / 2);
  } else {
    const set = new Set(focus);
    const pass = (isFocus) => {
      for (const f of geo.features) {
        if (f.b[2] < b[0] || f.b[0] > b[2] || f.b[3] < b[1] || f.b[1] > b[3]) continue;
        if ((set.has(f.n) || set.has(f.a)) !== isFocus) continue;
        c.beginPath();
        for (const ring of f.r) {
          for (let i = 0; i < ring.length; i += 2) { const [px, py] = project(ring[i], ring[i + 1]); if (i === 0) c.moveTo(px, py); else c.lineTo(px, py); }
          c.closePath();
        }
        if (isFocus) { c.shadowColor = 'rgba(0,0,0,0)'; c.fillStyle = paint(theme, 'accent1'); c.strokeStyle = paint(theme, 'ink'); c.lineWidth = 3; }
        else { c.shadowColor = paint(theme, 'shadow'); c.shadowBlur = 10; c.shadowOffsetY = 6; c.fillStyle = paint(theme, 'paper'); c.strokeStyle = paint(theme, 'inkSoft'); c.lineWidth = 1.6; }
        c.fill('evenodd');
        c.shadowColor = 'rgba(0,0,0,0)'; c.shadowBlur = 0; c.shadowOffsetY = 0;
        c.globalAlpha = isFocus ? 1 : 0.55; c.stroke(); c.globalAlpha = 1;
      }
    };
    pass(false); pass(true);
  }
  c.restore();
  c.strokeStyle = paint(theme, 'inkSoft'); c.lineWidth = 3; rrect(c, 1.5, 1.5, w - 3, h - 3, 10); c.stroke();
}

function drawPin(ctx, theme, px, py, p, sc, pp) {
  const r = 17 * sc, hh = 34 * sc;
  ctx.save();
  ctx.translate(px, py);
  ctx.globalAlpha *= clamp01(pp * 3);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(2, 2, 10 * sc, 4 * sc, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = paint(theme, p.color, 'accent1'); ctx.strokeStyle = paint(theme, 'ink'); ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(-r * 0.87, -hh + r * 0.5);
  ctx.arc(0, -hh, r, (5 * Math.PI) / 6, 2 * Math.PI + Math.PI / 6, false);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = paint(theme, 'white');
  ctx.beginPath(); ctx.arc(0, -hh, r * 0.38, 0, Math.PI * 2); ctx.fill();
  if (p.label) {
    ctx.font = font(theme, 'text', 30, '700');
    const tw = ctx.measureText(p.label).width, tagW = tw + 28, tagH = 46;
    const tx = p.side === 'left' ? -(r + 10) - tagW : r + 10;
    ctx.fillStyle = paint(theme, 'white'); ctx.strokeStyle = paint(theme, 'ink'); ctx.lineWidth = 2.5;
    rrect(ctx, tx, -hh - tagH / 2, tagW, tagH, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = paint(theme, 'ink'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.label, tx + tagW / 2, -hh + 1);
  }
  ctx.restore();
}
