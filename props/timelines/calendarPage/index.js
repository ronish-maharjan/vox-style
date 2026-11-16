// props/timelines/calendarPage/index.js — a calendar sheet showing one date: coloured month band with binder holes, big day number, weekday and year. Usage: { "prop":"calendarPage", "slots":{ "date":"1997-07-01" } }
import { paint, font, cached, num, margins, rrect, toRGB } from 'vox-studio/kit/look.js';
import { hashStr } from 'vox-studio/core/helpers.js';
import { clamp, edit, grain, placePiece, stage, enterState } from 'vox-studio/kit/paper.js';

const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const OFF = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];

/** "YYYY-MM-DD" to { y, mo, d, wd } (wd 0 = Sunday, Gregorian), or null. */
function parse(v) {
  const t = /^\s*(\d{1,4})-(\d{1,2})-(\d{1,2})\s*$/.exec(String(v ?? ''));
  if (!t) return null;
  const y = +t[1], mo = +t[2], d = +t[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const yy = mo < 3 ? y - 1 : y;
  const wd = (((yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) + OFF[mo - 1] + d) % 7) + 7) % 7;
  return { y, mo, d, wd };
}

export default {
  meta: {
    name: 'calendarPage', category: 'timelines',
    use: 'A calendar sheet that shows one exact date: month on a coloured band, a big day number, weekday and year. Give the date as "YYYY-MM-DD". Good for "On July 1st, 1997..." moments.',
    avoid: 'Showing several dates (use timeline), or a date without a day (use bigNumber for a year).',
    slots: { date: 'string' },
    options: { weekday: 'boolean?', color: 'color?' },
    defaultDuration: 3, space: 'world', depth: 0.5,
    example: { slots: { date: '1997-07-01' }, options: { color: 'accent1' } },
  },

  draw(ctx, o, env) {
    const { W, H, theme } = env, { a, vis } = enterState(o);
    if (vis <= 0.001) return;
    const m = margins(env), dt = parse(o.date), wd = o.weekday !== false;
    const availW = W - m.left - m.right - 60, availH = H - m.top - m.bottom - 60;
    const fw = Math.round(clamp(num(o.w, W > H ? 440 : 560), 200, Math.max(200, Math.min(availW, availH / 1.15)))), fh = Math.round(fw * 1.15), Q = 46;
    const band = paint(theme, o.color, 'accent1'), [r, g, b] = Array.from(toRGB(band));
    const onBand = 0.299 * r + 0.587 * g + 0.114 * b < 150 ? paint(theme, 'white') : paint(theme, 'ink');
    const key = `calendarPage:${o.date}:${wd}:${band}:${fw}`;
    const spr = cached(env, key, fw + 2 * Q, fh + 2 * Q, (c) => paintPage(c, env, { fw, fh, Q, dt, wd, band, onBand, sd: hashStr(String(o.date)) | 0 }));

    ctx.save();
    stage(ctx, env, o, a);
    ctx.globalAlpha *= vis;
    ctx.drawImage(spr, -(fw + 2 * Q) / 2, -(fh + 2 * Q) / 2);
    ctx.restore();
  },
};

function paintPage(c, env, d) {
  const { theme } = env, { fw, fh, Q, dt, wd, band, onBand, sd } = d;
  const P = env.createCanvas(fw, fh), g = P.getContext('2d'), bh = Math.round(fh * 0.24), body = fh - bh;
  g.fillStyle = paint(theme, 'white'); rrect(g, 0, 0, fw, fh, 6); g.fill();
  g.save(); rrect(g, 0, 0, fw, fh, 6); g.clip();
  g.fillStyle = band; g.fillRect(0, 0, fw, bh);
  g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(0, bh, fw, 3);
  g.restore();
  g.textAlign = 'center'; g.textBaseline = 'middle';

  const head = dt ? MONTHS[dt.mo - 1] : 'DATE?';
  let size = Math.round(bh * 0.5);
  for (; size > 18; size -= 2) { g.font = font(theme, 'display', size, '400'); if (g.measureText(head).width <= fw * 0.74) break; }
  g.font = font(theme, 'display', size, '400'); g.fillStyle = onBand; g.fillText(head, fw / 2, bh * 0.56);
  for (const hx of [0.2, 0.8]) {
    g.beginPath(); g.arc(fw * hx, bh * 0.2, fw * 0.022, 0, Math.PI * 2);
    g.fillStyle = paint(theme, 'paperDark'); g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(0,0,0,0.3)'; g.stroke();
  }

  g.fillStyle = paint(theme, 'inkSoft');
  if (dt && wd) { g.font = font(theme, 'typed', Math.round(fw * 0.075), '400'); g.fillText(DAYS[dt.wd], fw / 2, bh + body * 0.15); }
  g.fillStyle = paint(theme, 'ink'); g.font = font(theme, 'display', Math.round(body * 0.6), '400');
  g.fillText(dt ? String(dt.d) : '?', fw / 2, bh + body * 0.52);
  if (dt) { g.fillStyle = paint(theme, 'inkSoft'); g.font = font(theme, 'typed', Math.round(fw * 0.085), '400'); g.fillText(String(dt.y), fw / 2, fh - body * 0.1); }

  edit(g, fw, fh, (p, i, x, y) => {
    if (!p[i + 3]) return;
    const n = (grain(x, y, sd + 7) - 0.5) * 8;
    p[i] += n; p[i + 1] += n; p[i + 2] += n;
  });
  placePiece(c, env, P, fw, fh, Q);
}
