// core/assets.js — image cache with placeholders. Usage:
//   const assets = createAssets({ loadImage, createCanvas, resolvePath });
//   await assets.preload({ photo1: 'assets/a.jpg' }); const { img, w, h, placeholder } = assets.get('photo1');
// loadImage/createCanvas are injected by the backend (Node canvas or browser) so this file stays DOM-free.
export function createAssets({ loadImage, createCanvas, resolvePath = (s) => s }) {
  const images = new Map(), errors = new Map(), holders = new Map();

  function placeholder(name, w = 800, h = 600) {
    const key = `${name}|${w}x${h}`;
    if (!holders.has(key)) {
      const c = createCanvas(w, h), g = c.getContext('2d');
      g.fillStyle = '#d9d2c3'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#b8ae98'; g.lineWidth = 6;
      for (let i = -h; i < w; i += 40) { g.beginPath(); g.moveTo(i, h); g.lineTo(i + h, 0); g.stroke(); }
      g.fillStyle = '#E8452C'; g.font = '700 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(`MISSING: ${name}`, w / 2, h / 2);
      holders.set(key, c);
    }
    return holders.get(key);
  }
  return {
    async preload(manifest = {}) {
      await Promise.all(Object.entries(manifest).map(async ([name, src]) => {
        try { images.set(name, await loadImage(resolvePath(src))); }
        catch (e) { errors.set(name, `${src}: ${e.message}`); }
      }));
      return this.missing();
    },
    has: (name) => images.has(name),
    /** always returns something drawable */
    get(name) {
      const img = images.get(name);
      if (img) return { img, w: img.width, h: img.height, placeholder: false };
      const c = placeholder(name);
      return { img: c, w: c.width, h: c.height, placeholder: true };
    },
    missing: () => [...errors.entries()].map(([name, why]) => ({ name, why })),
  };
}
