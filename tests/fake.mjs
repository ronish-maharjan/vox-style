// tests/fake.mjs — recording fake canvas context. Usage: const ctx = fakeCtx(); ...draw...; ctx.log
const fmt = (a) => (typeof a === 'number' ? +a.toFixed(3) : typeof a === 'object' ? '[obj]' : String(a));
export function fakeCtx(log = []) {
  const state = {};
  return new Proxy({}, {
    get(_, k) {
      if (k === 'log') return log;
      if (k === 'measureText') return (s) => ({ width: String(s).length * 10 });
      if (k === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
      if (k in state) return state[k];
      return (...a) => { log.push(`${String(k)}(${a.map(fmt).join(',')})`); };
    },
    set(_, k, v) { state[k] = v; log.push(`${String(k)}=${fmt(v)}`); return true; },
  });
}
export const fakeCanvas = (w, h) => ({ width: w, height: h, getContext: () => fakeCtx() });
