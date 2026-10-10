// lib/layout.js — layout relativo multi-formato (16:9, 9:16, 1:1).
// Regra: REENQUADRAR por formato, nunca recortar. Posicione tudo em unidades relativas
// e use pick() para trocar composição (ex.: lado a lado no 16:9, empilhado no 9:16).

export const SIZES = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080] };

/** Áreas seguras (fração do quadro). 9:16 reserva espaço para a interface de Reels/TikTok/Shorts. */
export const SAFE = {
  '16:9': { top: 0.07, right: 0.05, bottom: 0.08, left: 0.05 },
  '9:16': { top: 0.11, right: 0.1, bottom: 0.2, left: 0.07 },
  '1:1': { top: 0.07, right: 0.07, bottom: 0.08, left: 0.07 },
};

export function getFormat() {
  const f = (typeof location !== 'undefined' && new URLSearchParams(location.search).get('format')) || '16:9';
  return SIZES[f] ? f : '16:9';
}

/** Objeto de layout do formato atual. */
export function createLayout(format = getFormat()) {
  const [W, H] = SIZES[format];
  const orientation = W > H ? 'landscape' : W < H ? 'portrait' : 'square';
  const s = SAFE[format];
  const safe = { x: s.left * W, y: s.top * H, w: W * (1 - s.left - s.right), h: H * (1 - s.top - s.bottom) };
  safe.cx = safe.x + safe.w / 2; safe.cy = safe.y + safe.h / 2;
  const L = {
    format, W, H, orientation, safe,
    isPortrait: orientation === 'portrait', isLandscape: orientation === 'landscape', isSquare: orientation === 'square',
    /** 1u = 1% do lado menor. Tamanhos de fonte/ícones devem usar u. */
    u: Math.min(W, H) / 100,
    vw: (p) => (W * p) / 100,
    vh: (p) => (H * p) / 100,
    /**
     * Escolhe valor por formato: pick({ '16:9': a, '9:16': b, '1:1': c }) ou
     * pick({ landscape: a, portrait: b, square: c }) ou pick({ default: x, portrait: y }).
     */
    pick(map) {
      if (format in map) return map[format];
      if (orientation in map) return map[orientation];
      if (orientation === 'square' && 'landscape' in map) return map.landscape;
      return map.default;
    },
    /** Ponto relativo à área segura: rel(0,0) = canto sup. esq. seguro; rel(0.5,0.5) = centro seguro. */
    rel: (px, py) => ({ x: safe.x + safe.w * px, y: safe.y + safe.h * py }),
    /** Divide a área segura em grade; cell(c, r, cs=1, rs=1) devolve {x,y,w,h,cx,cy}. */
    grid(cols, rows, gap = 0) {
      const cw = (safe.w - gap * (cols - 1)) / cols, rh = (safe.h - gap * (rows - 1)) / rows;
      return (c, r, cs = 1, rs = 1) => {
        const x = safe.x + c * (cw + gap), y = safe.y + r * (rh + gap);
        const w = cw * cs + gap * (cs - 1), h = rh * rs + gap * (rs - 1);
        return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
      };
    },
    /** Escala para caber (contain) um bloco de wxh dentro de uma caixa — nunca recorta. */
    contain(w, h, box = safe) { return Math.min(box.w / w, box.h / h); },
  };
  return L;
}

/** Publica o layout como CSS: html[data-format], --W --H --u --safe-* (px). */
export function applyRoot(L) {
  const r = document.documentElement;
  r.dataset.format = L.format;
  r.dataset.orientation = L.orientation;
  const set = (k, v) => r.style.setProperty(k, v);
  set('--W', L.W + 'px'); set('--H', L.H + 'px'); set('--u', L.u + 'px');
  set('--safe-x', L.safe.x + 'px'); set('--safe-y', L.safe.y + 'px');
  set('--safe-w', L.safe.w + 'px'); set('--safe-h', L.safe.h + 'px');
  return L;
}

/** Posiciona um elemento absoluto num retângulo {x,y,w,h}. */
export function place(el, { x, y, w, h }) {
  Object.assign(el.style, { position: 'absolute', left: x + 'px', top: y + 'px' });
  if (w != null) el.style.width = w + 'px';
  if (h != null) el.style.height = h + 'px';
}

/**
 * Ajusta font-size para o texto caber em maxW (e maxH opcional) sem quebrar a regra de legibilidade.
 * Determinístico: depende só das fontes carregadas. Retorna o tamanho final em px.
 */
export function fitText(el, maxW, { max = 400, min = 12, maxH = Infinity } = {}) {
  let lo = min, hi = max;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    el.style.fontSize = mid + 'px';
    if (el.scrollWidth <= maxW && el.scrollHeight <= maxH) lo = mid; else hi = mid;
  }
  el.style.fontSize = lo + 'px';
  return lo;
}
