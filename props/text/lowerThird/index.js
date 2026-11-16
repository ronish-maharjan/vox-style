// props/text/lowerThird/index.js — name + title card that wipes in. Usage: { "prop":"lowerThird", "slots":{ "name":"Margaret Thatcher", "title":"UK Prime Minister" }, "at":"word:thatcher" }
import { paint, font, anim, num, margins, rrect, clamp01 } from 'vox-studio/kit/look.js';
import { dropShadow } from 'vox-studio/core/helpers.js';

export default {
  meta: {
    name: 'lowerThird', category: 'text',
    use: 'Identify a person or place with a name and an optional title. Sits just above the caption band and wipes in.',
    avoid: 'Long sentences (names and short titles only), or using it for general text; use it once per person.',
    slots: { name: 'string', title: 'string?' },
    options: { accent: 'color?', side: 'enum:left|right' },
    defaultDuration: 3.5, space: 'screen',
    example: { slots: { name: 'Margaret Thatcher', title: 'UK Prime Minister, 1982' }, options: { side: 'left' } },
  },

  draw(ctx, o, env) {
    const { W, H, theme } = env;
    const { a, x } = anim(o);
    if (a <= 0.001 || x >= 1) return;
    const m = margins(env);
    const maxW = W - m.left - m.right;
    const nameTxt = String(o.name ?? '').toUpperCase();
    const titleTxt = o.title ? String(o.title) : '';
    const padX = 40, padY = 24;

    let ns = 78; ctx.font = font(theme, 'display', ns);
    while (ns > 38 && ctx.measureText(nameTxt).width > maxW - padX * 2 - 16) { ns -= 2; ctx.font = font(theme, 'display', ns); }
    const nw = ctx.measureText(nameTxt).width;
    let ts = 34; ctx.font = font(theme, 'text', ts, '600');
    while (ts > 20 && ctx.measureText(titleTxt).width > maxW - 80) { ts -= 2; ctx.font = font(theme, 'text', ts, '600'); }
    const tw = titleTxt ? ctx.measureText(titleTxt).width : 0;

    const cardW = Math.min(maxW, nw + padX * 2 + 16), cardH = ns * 1.1 + padY * 2;
    const tagH = titleTxt ? ts + 26 : 0, total = cardH + tagH;
    const cy = num(o.y, H - m.bottom - total / 2 - 24);
    const left = o.x !== undefined ? num(o.x, W / 2) - cardW / 2 : (o.side === 'right' ? W - m.right - cardW : m.left);
    const top = cy - total / 2;
    const accent = paint(theme, o.accent, 'accent1');
    const right = o.side === 'right';

    ctx.save();
    ctx.globalAlpha *= (1 - x);
    ctx.translate((right ? 1 : -1) * -x * 60 * -1, 0);

    // wipe the card in
    const reveal = (cardW + 80) * clamp01(a);
    ctx.save();
    ctx.beginPath();
    if (right) ctx.rect(left + cardW + 40 - reveal, top - 40, reveal, total + 80); else ctx.rect(left - 40, top - 40, reveal, total + 80);
    ctx.clip();
    dropShadow(ctx, theme, () => { ctx.fillStyle = paint(theme, 'white'); ctx.fillRect(left, top, cardW, cardH); }, {});
    ctx.fillStyle = accent; ctx.fillRect(left, top, 16, cardH);
    ctx.fillStyle = paint(theme, 'highlight'); ctx.fillRect(left + padX + 8 - 6, top + cardH / 2 + ns * 0.08, nw + 12, ns * 0.28);
    ctx.fillStyle = paint(theme, 'ink'); ctx.font = font(theme, 'display', ns);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(nameTxt, left + padX + 8, top + cardH / 2 + ns * 0.04);
    ctx.restore();

    // title tag pops in after the wipe is under way
    const ta = clamp01((a - 0.4) / 0.6);
    if (titleTxt && ta > 0) {
      ctx.save();
      ctx.globalAlpha *= ta;
      ctx.translate(left + 24 + (tw + 44) / 2, top + cardH + tagH / 2 - 4 - (1 - ta) * 10);
      ctx.rotate((-1 * Math.PI) / 180);
      ctx.fillStyle = paint(theme, 'accent2'); rrect(ctx, -(tw + 44) / 2, -tagH / 2 + 4, tw + 44, tagH - 8, 3); ctx.fill();
      ctx.fillStyle = paint(theme, 'white'); ctx.font = font(theme, 'text', ts, '600');
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(titleTxt, 0, 1);
      ctx.restore();
    }
    ctx.restore();
  },
};
