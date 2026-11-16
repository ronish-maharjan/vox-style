// backends/browser.js — the ONLY place that touches the DOM. Usage: const be = browserBackend('/projects/demo/')
export function browserBackend(baseUrl) {
  return {
    createCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; },
    loadImage: (src) => new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i); i.onerror = () => rej(new Error('failed to load image')); i.src = src;
    }),
    resolvePath: (s) => baseUrl + s,
    async readJSON(name, { optional = false } = {}) {
      const r = await fetch(baseUrl + name, { cache: 'no-store' });
      if (r.status === 404 && optional) return null;
      if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
      return r.json();
    },
  };
}
