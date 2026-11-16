// props/collage/paperScrap/index.js — a torn scrap of coloured paper with text (a label, a name, a date). Usage: { "prop":"paperScrap", "slots":{ "text":"THE LAST DAY" }, "options":{ "color":"kraft" } }
import { paint, font, cached, num, margins, toRGB } from 'vox-studio/kit/look.js';
import { hashStr, seededRandom } from 'vox-studio/core/helpers.js';
import { tornPath } from 'vox-studio/kit/shapes.js';
import { clamp, edit, grain, placePiece, stage, enterState } from 'vox-studio/kit/paper.js';

const FACES = ['display', 'typed', 'text'];

export default {
  meta: {
    name: 'paperScrap', category: 'collage',
    use: 'Short text on a torn scrap of paper, like a cut-out headline or a handwritten label: names, dates, one-line claims. Kraft by default; use an accent colour for emphasis.',
    avoid: 'Paragraphs (keep under about 8 words), more than two at once, or text that must be read for long (use lowerThird).',
    slots: { text: 'string' },
    options: { face: 'enum:display|typed|text', size: 'number?', color: 'color?', textColor: 'color?' },
    defaultDuration: 3, defaultSize: { w: 520, h: 200 }, space: 'world', depth: 0.6,
    example: { slots: { text: 'THE LAST DAY' }, options: { face: 'display' } },
  },

  draw(ctx, o, env) {
    const { W, H, theme } = env;
    const { a, vis } = enterState(o);
    if (vis <= 0.001) return;
    const m = margins(env), face = FACES.includes(o.face) ? o.face : 'display';
    const text = String(o.text ?? '').trim().slice(0, 120);
    const availW = W - m.left - m.right - 80, availH = H - m.top - m.bottom - 80;
    const maxW = Math.min(num(o.w, availW * 0.9), availW);
    let size = Math.round(clamp(num(o.size, W > H ? 72 : 88), 24, 220)), lines, widest;
    ctx.save();
    for (;;) {
      ctx.font = font(theme, face, size, face === 'display' ? '400' : '600');
      lines = wrap(ctx, text, maxW - size * 1.1);
      widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
      if ((widest <= maxW - size * 1.1 && lines.length * size * 1.12 <= availH) || size <= 24) break;
      size -= 4;
    }
    ctx.restore();
    const fw = Math.ceil(widest + size * 1.1), fh = Math.ceil(lines.length * size * 1.12 + size * 0.8), Q = 46;
    const bg = paint(theme, o.color, 'kraft'), [r, g, b] = Array.from(toRGB(bg));
    const fg = o.textColor ? paint(theme, o.textColor) : 0.299 * r + 0.587 * g + 0.114 * b < 150 ? paint(theme, 'white') : paint(theme, 'ink');
    const key = `paperScrap:${text}:${face}:${size}:${bg}:${fg}:${fw}x${fh}`;
    const spr = cached(env, key, fw + 2 * Q, fh + 2 * Q, (c) => paintScrap(c, env, { fw, fh, Q, lines, size, face, bg, fg, sd: hashStr(text) | 0 }));

    ctx.save();
    stage(ctx, env, o, a);
    ctx.globalAlpha *= vis;
    ctx.drawImage(spr, -(fw + 2 * Q) / 2, -(fh + 2 * Q) / 2);
    ctx.restore();
  },
};

function wrap(g, text, maxW) {
  const out = [];
  for (const para of text.split('\n')) {
    let cur = '';
    for (const w of para.split(/\s+/).filter(Boolean)) {
      const t = cur ? `${cur} ${w}` : w;
      if (cur && g.measureText(t).width > maxW) { out.push(cur); cur = w; } else cur = t;
    }
    out.push(cur);
  }
  return out.length ? out : [''];
}

function paintScrap(c, env, d) {
  const { theme } = env, { fw, fh, Q, lines, size, face, bg, fg, sd } = d;
  const P = env.createCanvas(fw, fh), g = P.getContext('2d');
  const torn = (grow, col) => {
    g.save(); g.translate(fw / 2, fh / 2);
    tornPath(g, fw - grow, fh - grow, seededRandom(hashStr(`scrap:${sd}:${fw}x${fh}`)), theme.edge.tornAmp * 0.8, theme.edge.tornStep);
    g.fillStyle = col; g.fill(); g.restore();
  };
  torn(8, paint(theme, 'white'));
  torn(16, bg);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = font(theme, face, size, face === 'display' ? '400' : '600');
  lines.forEach((l, i) => g.fillText(l, fw / 2, fh / 2 + (i - (lines.length - 1) / 2) * size * 1.12));
  edit(g, fw, fh, (p, i, x, y) => {
    if (!p[i + 3]) return;
    const n = (grain(x, y, sd + 7) - 0.5) * 10;
    p[i] += n; p[i + 1] += n; p[i + 2] += n;
  });
  placePiece(c, env, P, fw, fh, Q);
}
