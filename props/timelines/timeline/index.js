// props/timelines/timeline/index.js — dated nodes revealed one by one along a hand-drawn line, vertical or horizontal. Usage: { "prop":"timeline", "slots":{ "nodes":[{ "date":"1842", "label":"Ceded to Britain" },{ "date":"1997", "label":"Handover" }] }, "options":{ "focus":2 } }
import { paint, font, anim, num, clamp01, margins, rngFor, toRGB } from 'vox-studio/kit/look.js';
import { dropShadow, hashStr, seededRandom } from 'vox-studio/core/helpers.js';
import { outCubic, tornPath } from 'vox-studio/kit/shapes.js';
import { clamp, densify, wobble, strokePts, wrapLines } from 'vox-studio/kit/marks.js';

export default {
  meta: {
    name: 'timeline', category: 'timelines',
    use: 'Dated events revealed one by one along a hand-drawn line, each with a kraft date tag and a short label. Vertical in 9:16, horizontal in 16:9. Give 2 to 8 nodes as { date, label }; nodes arrive evenly over the layer "enter" time, so set enter to about the length of the narration for the list. focus highlights one node (counting from 1).',
    avoid: 'More than 8 nodes, or labels longer than about 10 words (write tighter labels instead).',
    slots: { nodes: 'array' },
    options: { dir: 'enum:auto|vertical|horizontal', focus: 'number?', color: 'color?' },
    defaultDuration: 6, space: 'world', depth: 0.5, enter: 2.4,
    example: { slots: { nodes: [{ date: '1842', label: 'Hong Kong Island ceded to Britain' }, { date: '1898', label: '99-year lease on the New Territories' }, { date: '1997', label: 'Handover to China' }] }, options: { focus: 3 } },
  },

  draw(ctx, o, env) {
    const { W, H, theme } = env, { a, x } = anim(o);
    if (a <= 0.001) return;
    const nodes = readNodes(o.nodes), N = nodes.length;
    if (!N) return;
    const m = margins(env), rng = rngFor(env, 'timeline');
    const L = m.left, R = W - m.right, T = m.top, B = H - m.bottom;
    const vert = o.dir === 'vertical' || (o.dir !== 'horizontal' && W <= H);
    const focus = Math.round(num(o.focus, 0)) - 1;
    const col = paint(theme, o.color, 'accent1'), ink = paint(theme, 'ink'), kraft = paint(theme, 'kraft');
    const [cr, cg, cb] = Array.from(toRGB(col));
    const onCol = 0.299 * cr + 0.587 * cg + 0.114 * cb < 150 ? paint(theme, 'white') : ink;
    const lp = clamp01(a / 0.85);

    // positions of the nodes and sizes of their text
    const ax = num(o.x, L + 70), ay = num(o.y, (T + B) / 2);
    const y0 = T + 70, y1 = B - 50, x0 = L + 60, x1 = R - 60;
    const step = N > 1 ? (vert ? y1 - y0 : x1 - x0) / (N - 1) : 300;
    const bw = clamp(step * 2 - 30, 200, Math.min(560, R - L));
    const dsz = vert ? clamp(Math.round(step * 0.4), 30, 66) : clamp(Math.round(bw * 0.16), 30, 66);
    const lsz = vert ? clamp(Math.round(step * 0.2), 24, 40) : clamp(Math.round(bw * 0.075), 22, 38);
    const maxLines = vert ? clamp(Math.floor((step - dsz * 1.5) / (lsz * 1.2)), 1, 3) : 3;
    const textX = ax + 52, maxW = vert ? R - textX : bw;
    const P = nodes.map((_, i) => (vert ? [ax, N > 1 ? y0 + step * i : (T + B) / 2] : [N > 1 ? x0 + step * i : (L + R) / 2, ay]));
    const ext = vert ? [0, 50] : [50, 0];
    const A0 = [P[0][0] - ext[0], P[0][1] - ext[1]], A1 = [P[N - 1][0] + ext[0], P[N - 1][1] + ext[1]];
    const frac = (p) => (vert ? (p[1] - A0[1]) / (A1[1] - A0[1]) : (p[0] - A0[0]) / (A1[0] - A0[0]));

    ctx.save();
    ctx.globalAlpha *= 1 - x;
    strokePts(ctx, wobble(densify([A0, A1], 14), rng, 2.5), ink, theme.line.normal, lp);

    nodes.forEach((n, i) => {
      const tn = clamp01((lp - frac(P[i])) / 0.12), e = outCubic(tn);
      if (tn <= 0) return;
      const [nx, ny] = P[i], hot = i === focus;
      ctx.save();
      ctx.globalAlpha *= clamp01(tn * 2.5);
      ctx.translate(0, (1 - e) * 16);
      ctx.beginPath(); ctx.arc(nx, ny, (hot ? 21 : 15) * (0.4 + 0.6 * e), 0, Math.PI * 2);
      ctx.fillStyle = hot ? col : paint(theme, 'paper'); ctx.fill();
      ctx.lineWidth = 6; ctx.strokeStyle = ink; ctx.stroke();

      ctx.font = font(theme, 'text', lsz, '600');
      const lines = n.label ? wrapLines(ctx, n.label, maxW).slice(0, maxLines) : [];
      const tagH = n.date ? Math.round(dsz * 1.25) : 0, lh = Math.round(lsz * 1.2);
      const bh = tagH + (tagH && lines.length ? 8 : 0) + lines.length * lh;
      const cx = vert ? 0 : clamp(nx, L + bw / 2, R - bw / 2);
      const top = vert ? (tagH ? ny - tagH / 2 : ny - bh / 2) : i % 2 === 0 ? ay - 40 - bh : ay + 40;
      if (!vert) { ctx.strokeStyle = ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(nx, i % 2 === 0 ? ay - 40 : ay + 40); ctx.stroke(); }
      if (n.date) {
        ctx.font = font(theme, 'display', dsz, '400');
        const tw = Math.ceil(ctx.measureText(n.date).width + dsz * 0.8);
        const tcx = vert ? textX + tw / 2 : cx, tcy = top + tagH / 2;
        dropShadow(ctx, theme, () => {
          ctx.save(); ctx.translate(tcx, tcy);
          tornPath(ctx, tw, tagH, seededRandom(hashStr(`tl:${n.date}:${i}`)), theme.edge.tornAmp * 0.5, theme.edge.tornStep);
          ctx.fillStyle = hot ? col : kraft; ctx.fill(); ctx.restore();
        }, {});
        ctx.fillStyle = hot ? onCol : ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(n.date, tcx, tcy + 2);
      }
      ctx.font = font(theme, 'text', lsz, '600'); ctx.fillStyle = ink; ctx.textBaseline = 'top'; ctx.textAlign = vert ? 'left' : 'center';
      const ly = top + tagH + (tagH ? 8 : 0);
      lines.forEach((l, k) => ctx.fillText(l, vert ? textX : cx, ly + k * lh));
      ctx.restore();
    });
    ctx.restore();
  },
};

/** Accepts { date, label } objects or "date | label" strings; at most 8. */
function readNodes(v) {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 8).map((n) => {
    if (n && typeof n === 'object') return { date: String(n.date ?? '').slice(0, 24), label: String(n.label ?? n.text ?? '').slice(0, 90) };
    const [d, ...rest] = String(n ?? '').split('|');
    return rest.length ? { date: d.trim().slice(0, 24), label: rest.join('|').trim().slice(0, 90) } : { date: '', label: d.trim().slice(0, 90) };
  }).filter((n) => n.date || n.label);
}
