// props/annotations/markerCircle/index.js — hand-drawn marker circle / underline / box. Usage: { "prop":"markerCircle", "options":{ "x":600, "y":900, "w":300, "h":200, "shape":"circle" }, "at":"word:name" }
import { paint, anim, num, rngFor, clamp01 } from 'vox-studio/kit/look.js';

export default {
  meta: {
    name: 'markerCircle', category: 'annotations',
    use: 'Draw attention to something already on screen with a hand-drawn marker stroke (circle, underline or box) that draws itself.',
    avoid: 'Circling empty space, or using more than one at a time. x/y/w/h describe the target to mark, not the stroke.',
    slots: {},
    options: { shape: 'enum:circle|underline|box', color: 'color?', thickness: 'number?' },
    defaultDuration: 1.2, space: 'world', depth: 0.6,
    example: { slots: {}, options: { x: 540, y: 800, w: 360, h: 240, shape: 'circle' } },
  },

  draw(ctx, o, env) {
    const { W, H, theme } = env;
    const { a, x } = anim(o);
    if (a <= 0.001 || x >= 1) return;
    const w = num(o.w, 300), h = num(o.h, 200);
    const pts = shapePoints(o.shape ?? 'circle', w, h, rngFor(env, 'mark'));
    const th = num(o.thickness, (theme?.line?.bold ?? 10) * 1.2);
    const upto = clamp01(a) * (pts.length - 1);
    ctx.save();
    ctx.translate(num(o.x, W / 2), num(o.y, H / 2));
    ctx.globalAlpha *= (1 - x);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = paint(theme, o.color, 'accent1');
    for (let i = 0; i < pts.length - 1 && i < upto; i++) {
      const f = Math.min(1, upto - i), [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      ctx.lineWidth = th * (0.75 + 0.45 * Math.sin((Math.PI * i) / (pts.length - 1)));
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f); ctx.stroke();
    }
    ctx.restore();
  },
};

function shapePoints(shape, w, h, rng) {
  const pts = [];
  if (shape === 'underline') {
    const y0 = h / 2 + 6, ph = rng.range(0, 6);
    for (let i = 0; i <= 30; i++) { const s = i / 30; pts.push([-w / 2 + w * s, y0 + Math.sin(s * 7 + ph) * 3 + rng.range(-1.5, 1.5)]); }
    for (let i = 0; i <= 24; i++) { const s = i / 24; pts.push([w * 0.45 - w * 0.85 * s, y0 + 16 + Math.sin(s * 6 + ph) * 3 + rng.range(-1.5, 1.5)]); }
    return pts;
  }
  if (shape === 'box') {
    const hw = w / 2 + 12, hh = h / 2 + 12;
    const corners = [[-hw - 8, -hh], [hw, -hh + 4], [hw + 4, hh], [-hw, hh + 4], [-hw + 2, -hh + h * 0.12]];
    for (let k = 0; k < 4; k++) {
      const [ax, ay] = corners[k], [bx, by] = corners[k + 1];
      for (let i = 0; i < 16; i++) { const s = i / 16; pts.push([ax + (bx - ax) * s + rng.range(-2.5, 2.5), ay + (by - ay) * s + rng.range(-2.5, 2.5)]); }
    }
    pts.push(corners[4]);
    return pts;
  }
  const n = 80, a0 = -2.4 + rng.range(-0.3, 0.3), sweep = Math.PI * 2 * 1.13, ph = rng.range(0, 6);
  for (let i = 0; i <= n; i++) {
    const s = i / n, ang = a0 + sweep * s;
    const rr = 1.05 - 0.1 * s + 0.025 * Math.sin(s * 9 + ph) + rng.range(-0.012, 0.012);
    pts.push([(w / 2) * 1.08 * rr * Math.cos(ang), (h / 2) * 1.08 * rr * Math.sin(ang)]);
  }
  return pts;
}
