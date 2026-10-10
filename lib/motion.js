// lib/motion.js — molas em fórmula fechada + helpers de animação determinística.
// Módulo ES puro: funciona no navegador (import '/lib/motion.js') e no Node.
// Tudo é função pura do tempo: spring(t) não depende de frames anteriores.

/** Presets (massa 1). ζ = damping / (2·√stiffness). */
export const PRESETS = {
  snappy:  { stiffness: 420, damping: 38 }, // ζ≈0.93 — UI, botões, cursores: overshoot mínimo (~0.1%)
  default: { stiffness: 170, damping: 21 }, // ζ≈0.80 — cards, containers, câmera: leve assentamento (~1.5%)
  heavy:   { stiffness: 110, damping: 22 }, // ζ≈1.05 — tipografia grande, logo, 3D: SEM overshoot
  playful: { stiffness: 230, damping: 11 }, // ζ≈0.36 — mascotes, elementos lúdicos: overshoot visível (~30%)
};

function resolve(opts) {
  if (!opts) return { ...PRESETS.default };
  if (typeof opts === 'string') {
    if (!PRESETS[opts]) throw new Error(`preset de mola desconhecido: ${opts}`);
    return { ...PRESETS[opts] };
  }
  const base = opts.preset ? PRESETS[opts.preset] : PRESETS.default;
  return { ...base, ...opts };
}

/**
 * Progresso normalizado 0→1 de uma mola no tempo t (segundos), solução analítica do oscilador amortecido.
 * opts: preset | { preset, stiffness, damping, mass, velocity (em unidades/s normalizadas) }
 * t < 0 → 0.
 */
export function springProgress(t, opts) {
  if (t <= 0) return 0;
  const { stiffness: k, damping: c, mass: m = 1, velocity: v0 = 0 } = resolve(opts);
  const w0 = Math.sqrt(k / m);
  const zeta = c / (2 * Math.sqrt(k * m));
  if (zeta < 1) {
    const a = zeta * w0;
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return 1 + Math.exp(-a * t) * (-Math.cos(wd * t) + ((v0 - a) / wd) * Math.sin(wd * t));
  }
  if (zeta === 1) {
    return 1 + Math.exp(-w0 * t) * (-1 + (v0 - w0) * t);
  }
  const s = Math.sqrt(zeta * zeta - 1);
  const r1 = -w0 * (zeta - s), r2 = -w0 * (zeta + s);
  const C1 = (v0 + r2) / (r1 - r2);
  const C2 = -1 - C1;
  return 1 + C1 * Math.exp(r1 * t) + C2 * Math.exp(r2 * t);
}

/**
 * spring(t, opts) → valor entre from e to.
 * opts aceita: nome de preset ou { preset, from=0, to=1, delay=0, stiffness, damping, mass, velocity }.
 */
export function spring(t, opts = 'default') {
  const o = typeof opts === 'string' ? { preset: opts } : opts;
  const from = o.from ?? 0, to = o.to ?? 1;
  return from + (to - from) * springProgress(t - (o.delay || 0), o);
}

/** Tempo (s) até a mola ficar a menos de `eps` do alvo para sempre (útil para planejar cenas). */
export function settleTime(opts = 'default', eps = 0.002) {
  const { stiffness: k, damping: c, mass: m = 1 } = resolve(opts);
  const w0 = Math.sqrt(k / m), zeta = c / (2 * Math.sqrt(k * m));
  const decay = zeta < 1 ? zeta * w0 : w0 * (zeta - Math.sqrt(zeta * zeta - 1));
  let t = Math.log(1 / eps) / decay;
  // refina pela envoltória real
  for (let s = t; s > 0; s -= 1 / 120) { if (Math.abs(1 - springProgress(s, opts)) > eps) return s + 1 / 120; }
  return t;
}

// ---------------------------------------------------------------- valores compostos
const isObj = (v) => v && typeof v === 'object';
function combine(a, b, f) {
  if (typeof a === 'number') return f(a, b);
  if (Array.isArray(a)) return a.map((x, i) => combine(x, b[i], f));
  if (isObj(a)) { const o = {}; for (const k in a) o[k] = combine(a[k], b[k], f); return o; }
  return b;
}
const add = (a, b) => combine(a, b, (x, y) => x + y);
const sub = (a, b) => combine(a, b, (x, y) => x - y);
const scl = (a, s) => combine(a, a, (x) => x * s);

/**
 * track(keyframes, t, preset): valor que muda de alvo várias vezes.
 * keyframes: [[t0, v0], [t1, v1], ...] ou [{t, v, preset?}, ...]; v pode ser número, array ou objeto.
 * Soma uma mola por mudança de alvo, cada uma começando no seu tempo (superposição → velocidade contínua).
 */
export function track(keyframes, t, preset = 'default') {
  const kf = keyframes.map((k) => (Array.isArray(k) ? { t: k[0], v: k[1] } : k));
  let value = kf[0].v;
  for (let i = 1; i < kf.length; i++) {
    if (t <= kf[i].t) break;
    const p = springProgress(t - kf[i].t, kf[i].preset || preset);
    value = add(value, scl(sub(kf[i].v, kf[i - 1].v), p));
  }
  return value;
}

/** Entrada e saída: 0 → 1 a partir de tIn, 1 → 0 a partir de tOut. */
export function inOut(t, tIn, tOut, preset = 'default', presetOut = preset) {
  return springProgress(t - tIn, preset) - (tOut == null ? 0 : springProgress(t - tOut, presetOut));
}

/** Atraso escalonado do i-ésimo item. order: 'start' | 'end' | 'center' | 'random' (determinístico). */
export function stagger(i, step = 0.06, { start = 0, total = 0, order = 'start', seed = 7 } = {}) {
  let k = i;
  if (order === 'end') k = total - 1 - i;
  else if (order === 'center') k = Math.abs(i - (total - 1) / 2);
  else if (order === 'random') k = rng(seed + i * 7919)() * total;
  return start + k * step;
}

// ---------------------------------------------------------------- matemática
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, p) => a + (b - a) * p;
export const mapRange = (x, a, b, c, d, clamped = true) => {
  const p = (x - a) / (b - a);
  return lerp(c, d, clamped ? clamp(p) : p);
};
/** Interpola números, arrays ou objetos componente a componente. */
export const mix = (a, b, p) => combine(a, b, (x, y) => x + (y - x) * p);

/** PRNG com semente (mulberry32). Use no lugar de Math.random. */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let r = Math.imul(s ^ (s >>> 15), 1 | s);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
/** Hash determinístico 0..1 de um inteiro. */
export const hash = (n) => rng(n * 2654435761)();
/** Ruído de valor 1D suave (determinístico). */
export function noise(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i + seed * 1013), hash(i + 1 + seed * 1013), u) * 2 - 1;
}

// ---------------------------------------------------------------- cores
function parseColor(c) {
  if (Array.isArray(c)) return c.length === 3 ? [...c, 1] : c;
  c = c.trim();
  if (c[0] === '#') {
    let h = c.slice(1);
    if (h.length <= 4) h = [...h].map((x) => x + x).join('');
    const n = parseInt(h.slice(0, 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1];
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; }
  throw new Error('cor não suportada: ' + c);
}
const toLin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const toSrgb = (v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
function toOklab([r, g, b]) {
  [r, g, b] = [toLin(r), toLin(g), toLin(b)];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function fromOklab([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)];
}
/** Mistura de cores perceptual (OKLab). Aceita #hex, rgb(), rgba() ou [r,g,b,a]. Retorna 'rgba(...)'. */
export function mixColor(a, b, p) {
  const A = parseColor(a), B = parseColor(b);
  const [r, g, bl] = fromOklab(mix(toOklab(A), toOklab(B), p)).map((v) => Math.round(clamp(v, 0, 255)));
  return `rgba(${r},${g},${bl},${+lerp(A[3], B[3], p).toFixed(4)})`;
}
/** Cor ao longo de uma paleta (p de 0 a 1). */
export const paletteAt = (colors, p) => {
  const x = clamp(p) * (colors.length - 1), i = Math.min(colors.length - 2, Math.floor(x));
  return mixColor(colors[i], colors[i + 1], x - i);
};

// ---------------------------------------------------------------- transforms
/** Interpola objetos de transform {x,y,z,scale,scaleX,scaleY,rotate,rotateX,rotateY,skewX} e devolve string CSS. */
export function transform(o) {
  const s = [];
  if (o.x || o.y || o.z) s.push(`translate3d(${o.x || 0}px,${o.y || 0}px,${o.z || 0}px)`);
  if (o.rotateX) s.push(`rotateX(${o.rotateX}deg)`);
  if (o.rotateY) s.push(`rotateY(${o.rotateY}deg)`);
  if (o.rotate) s.push(`rotate(${o.rotate}deg)`);
  if (o.skewX) s.push(`skewX(${o.skewX}deg)`);
  if (o.scale != null && o.scale !== 1) s.push(`scale(${o.scale})`);
  if (o.scaleX != null || o.scaleY != null) s.push(`scale(${o.scaleX ?? 1},${o.scaleY ?? 1})`);
  return s.join(' ') || 'none';
}
const IDENTITY = { x: 0, y: 0, z: 0, scale: 1, rotate: 0, rotateX: 0, rotateY: 0, skewX: 0 };
export const mixTransform = (a, b, p) => {
  const keys = Object.keys({ ...a, ...b });
  const A = {}, B = {};
  for (const k of keys) { A[k] = a[k] ?? IDENTITY[k] ?? 1; B[k] = b[k] ?? IDENTITY[k] ?? 1; }
  return transform(mix(A, B, p));
};

/** Aplica estilos rapidamente: set(el, {opacity, transform: {...}, ...}). */
export function set(el, styles) {
  for (const k in styles) {
    const v = styles[k];
    if (k === 'transform' && isObj(v)) el.style.transform = transform(v);
    else if (k.startsWith('--')) el.style.setProperty(k, v);
    else el.style[k] = v;
  }
}

/** Utilitário de cenas: devolve { index, local, progress, scene } para o tempo t. */
export function sceneAt(scenes, t) {
  for (let i = scenes.length - 1; i >= 0; i--) {
    if (t >= scenes[i].start) {
      const s = scenes[i], len = (s.end ?? Infinity) - s.start;
      return { index: i, scene: s, local: t - s.start, progress: clamp((t - s.start) / len) };
    }
  }
  return { index: 0, scene: scenes[0], local: t - scenes[0].start, progress: 0 };
}

// ---------------------------------------------------------------- ritmo
/**
 * Grade de batidas (espelha lib/audio.mjs → beatGrid). Use para cortar cenas na batida:
 *   const B = beats(120, 8); B.beat(4) → 2.0 s; B.bar(1) → 2.0 s; B.snap(2.13) → 2.0 s
 */
export function beats(bpm, duration, { offset = 0, beatsPerBar = 4 } = {}) {
  const spb = 60 / bpm;
  const list = [];
  for (let t = offset; t <= duration + 1e-9; t += spb) list.push(+t.toFixed(6));
  return {
    bpm, spb, list, beatsPerBar,
    beat: (n) => offset + n * spb,
    bar: (n) => offset + n * spb * beatsPerBar,
    snap: (t) => offset + Math.round((t - offset) / spb) * spb,
    /** Fase 0..1 dentro da batida atual (para pulsos). */
    phase: (t) => (((t - offset) / spb) % 1 + 1) % 1,
    /** Pulso que decai após cada batida (1 na batida → 0). */
    pulse: (t, decay = 8) => Math.exp(-decay * spb * ((((t - offset) / spb) % 1 + 1) % 1)),
  };
}
