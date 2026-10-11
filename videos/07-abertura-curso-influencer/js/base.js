// Base do 07-abertura: layout, texturas de papel, tratamento editorial das fotos (duotone + meio-tom,
// borda de papel recortada, sombra chapada), recortes e silhueta a partir das máscaras, cursor e utilidades.
// Tudo determinístico (rng com semente) e gerado uma vez em READY.
import { springProgress, rng, noise, clamp, lerp } from '/lib/motion.js';
import { createLayout, applyRoot } from '/lib/layout.js';
import { WORDS } from '../tempos.js';

export const L = applyRoot(createLayout());
export const { W, H, u, safe } = L;
export const P = L.isPortrait;
export const DPR = window.devicePixelRatio || 1;
export const $ = (id) => document.getElementById(id);
export const el = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; parent?.appendChild(e); return e; };
export const wt = (i) => WORDS[i].start;
export const we = (i) => WORDS[i].end;
export const sp = (t, preset = 'heavy') => springProgress(t, preset);
export const px = (v) => v + 'px';
export const INK = [22, 20, 18], PAPER = [242, 237, 228], WINE = [123, 36, 49], BORDER = [248, 245, 238];

// ------------------------------------------------------------------ área de página
export const headY = P ? safe.y + u * 3.2 : u * 5.2;          // fio de topo
export const footY = P ? safe.y + safe.h - u * 6.2 : H - u * 5.6; // fio de base
export const capSize = P ? u * 3.5 : u * 2.5;
export const capsTop = P ? footY - capSize * 3.2 : footY - capSize * 2.35;
/** caixa de conteúdo: entre o fio de topo e a faixa da legenda (nada de imagem sob a legenda) */
export const box = { x: safe.x, y: headY + u * 3, w: safe.w };
box.h = capsTop - u * 1.5 - box.y;
box.r = box.x + box.w; box.b = box.y + box.h; box.cx = box.x + box.w / 2; box.cy = box.y + box.h / 2;

// ------------------------------------------------------------------ texturas
let paperURL = '';
export function paperTexture() {
  const c = document.createElement('canvas'); const s = 0.5; c.width = Math.round(W * s); c.height = Math.round(H * s);
  const g = c.getContext('2d'); const img = g.createImageData(c.width, c.height); const r = rng(11);
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const blot = noise(x / 90 + noise(y / 140, 3) * 2, 1) * 0.5 + noise(y / 70, 2) * 0.5;
    const v = 255 - 7 - blot * 5 - r() * 9;
    const i = (y * c.width + x) * 4;
    img.data[i] = PAPER[0] * v / 255 + 13 * v / 255; img.data[i + 1] = PAPER[1] * v / 255 + 13 * v / 255; img.data[i + 2] = PAPER[2] * v / 255 + 13 * v / 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.lineCap = 'round';
  for (let k = 0; k < 900; k++) {
    const x = r() * c.width, y = r() * c.height, a = r() * Math.PI * 2, l = 3 + r() * 8;
    g.strokeStyle = `rgba(90,80,66,${0.04 + r() * 0.06})`; g.lineWidth = 0.4 + r() * 0.45;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  paperURL = c.toDataURL('image/png');
  return paperURL;
}
export function grainTexture(target) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), img = g.createImageData(256, 256), r = rng(42);
  for (let i = 0; i < img.data.length; i += 4) { const v = 128 + (r() - 0.5) * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  target.style.backgroundImage = `url(${c.toDataURL()})`;
}

// ------------------------------------------------------------------ página (camada opaca com papel + grid)
export function makePage(parent, { grid = true } = {}) {
  const page = el('section', 'page', parent);
  page.style.backgroundImage = `url(${paperURL})`;
  const cam = el('div', 'cam', page);
  const g = el('div', 'grid', cam);
  const parts = { cols: [], rules: [] };
  if (grid) {
    const COLS = P ? 6 : 12;
    for (let i = 0; i <= COLS; i++) {
      const c = el('div', 'col', g); Object.assign(c.style, { left: px(safe.x + (safe.w * i) / COLS), top: px(headY), height: px(footY - headY) });
      parts.cols.push(c);
    }
    for (const y of [headY, footY]) { const r = el('div', 'rule', g); Object.assign(r.style, { left: px(safe.x), top: px(y), width: px(safe.w) }); parts.rules.push(r); }
    const cm = u * 2.2;
    [[0, 0, 'Top', 'Left'], [1, 0, 'Top', 'Right'], [0, 1, 'Bottom', 'Left'], [1, 1, 'Bottom', 'Right']].forEach(([fx, fy, a, b]) => {
      const c = el('div', 'crop', g);
      Object.assign(c.style, { width: px(cm), height: px(cm), left: px(fx ? W - u * 1.6 - cm : u * 1.6), top: px(fy ? H - u * 1.6 - cm : u * 1.6) });
      c.style['border' + a + 'Width'] = '1px'; c.style['border' + b + 'Width'] = '1px';
    });
  }
  const layer = el('div', 'layer', cam);
  return { page, cam, layer, grid: parts };
}

/** zoom lento de câmera (≤ 2%) + deriva mínima, sem expor borda */
export function camera(cam, t, t0, { zoom = 0.018, seed = 1 } = {}) {
  const z = 1 + zoom * sp((t - t0) / 3.2);
  const lim = (z - 1) * 0.45;
  const dx = noise(t * 0.15, seed) * W * lim * 0.4, dy = noise(t * 0.12, seed + 4) * H * lim * 0.4;
  cam.style.transform = `translate(${dx}px,${dy}px) scale(${z})`;
}

/** virada de página: a nova página entra pela direita, com faixa de sombra chapada na borda */
export function pageTurn(page, edge, t, t0, dur = 0.85) {
  const p = clamp(springProgress((t - t0) * (0.7 / dur), 'heavy'), 0, 1);
  const x = (1 - p) * W;
  page.style.clipPath = p >= 0.999 ? '' : `inset(0 0 0 ${x}px)`;
  if (edge) {
    const on = p > 0.001 && p < 0.998;
    edge.style.display = on ? 'block' : 'none';
    if (on) { edge.style.transform = `translateX(${x - u * 1.4}px)`; }
  }
  return p;
}

// ------------------------------------------------------------------ texto
export function splitChars(target, text) {
  target.innerHTML = [...text].map((c) => `<span class="ch">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
  return [...target.children];
}
export function riseChars(chars, t, t0, step = 0.028, dist = 1.25) {
  chars.forEach((c, i) => { const p = sp(t - t0 - i * step); c.style.transform = `translateY(${(1 - p) * dist * 100}%)`; });
}
/** Distância do topo da caixa de linha (line-height:1) até o topo das versais. */
export function capTop(size, family = '"Instrument Serif"', weight = 400, style = 'normal') {
  const g = document.createElement('canvas').getContext('2d');
  g.font = `${style} ${weight} ${size}px ${family}`;
  const m = g.measureText('H');
  return (size - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent - m.actualBoundingBoxAscent;
}
export function capHeight(size, family = '"Instrument Serif"') {
  const g = document.createElement('canvas').getContext('2d'); g.font = `400 ${size}px ${family}`; return g.measureText('H').actualBoundingBoxAscent;
}
/** Linha de texto com máscara (as letras/palavras sobem de dentro dela). Retorna {mask, inner, chars|words}. */
export function maskedLine(parent, text, { cls = 'serif', size, x, capY, italic = false, by = 'chars', color } = {}) {
  const m = el('div', 'mask', parent);
  const inner = el('div', cls, m);
  inner.style.fontSize = px(size); inner.style.lineHeight = '1'; inner.style.whiteSpace = 'nowrap';
  if (italic) inner.style.fontStyle = 'italic';
  if (color) inner.style.color = color;
  let parts;
  if (by === 'chars') parts = splitChars(inner, text);
  else { inner.innerHTML = text.split(' ').map((w) => `<span class="ch">${w}</span>`).join('<span class="ch">&nbsp;</span>'); parts = [...inner.children].filter((_, i) => i % 2 === 0); }
  const ct = capTop(size, '"Instrument Serif"', 400, italic ? 'italic' : 'normal');
  const padTop = size * 0.32;
  Object.assign(m.style, { left: px(x - size * 0.05), top: px(capY - ct - padTop), paddingTop: px(padTop), paddingLeft: px(size * 0.05), paddingRight: px(size * 0.12), height: px(size * 1.06 + padTop) });
  return { mask: m, inner, parts, width: () => inner.getBoundingClientRect().width };
}

// ------------------------------------------------------------------ imagens
export async function loadImage(src) {
  const img = new Image(); img.src = src; await img.decode(); return img;
}
function srcRect(img, ratio, focus = [0.5, 0.5]) {
  const ir = img.naturalWidth / img.naturalHeight;
  let sw = img.naturalWidth, sh = img.naturalHeight;
  if (ratio && ir > ratio) sw = sh * ratio; else if (ratio) sh = sw / ratio;
  const sx = clamp(focus[0] * img.naturalWidth - sw / 2, 0, img.naturalWidth - sw);
  const sy = clamp(focus[1] * img.naturalHeight - sh / 2, 0, img.naturalHeight - sh);
  return { sx, sy, sw, sh };
}
/** Duotone tinta→papel (ou tritone com vinho) + meio-tom de pontos a 45°. w,h em px de canvas. */
export function treat(img, w, h, { ratio, focus, tone = 'duo', halftone = 0.42, cell } = {}) {
  const c = document.createElement('canvas'); c.width = Math.round(w); c.height = Math.round(h);
  const g = c.getContext('2d');
  const s = srcRect(img, ratio ?? w / h, focus);
  g.drawImage(img, s.sx, s.sy, s.sw, s.sh, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
  const cs = cell ?? Math.max(2.4, c.height / 140);
  const k = Math.SQRT1_2;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const i = (y * c.width + x) * 4;
    let l = (0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2]) / 255;
    l = clamp((l - 0.06) / 0.86); l = l * l * (3 - 2 * l) * 0.55 + l * 0.45;     // contraste suave
    const uu = (x * k + y * k) / cs, vv = (-x * k + y * k) / cs;
    const fu = uu - Math.floor(uu) - 0.5, fv = vv - Math.floor(vv) - 0.5;
    const dist = Math.sqrt(fu * fu + fv * fv);
    const r = Math.sqrt(1 - l) * 0.64;
    const cov = clamp((r - dist) / 0.09 + 0.5);
    const v = lerp(l, 1 - cov, halftone);
    let col;
    if (tone === 'wine') col = v < 0.5 ? mix3(INK, WINE, v * 2) : mix3(WINE, PAPER, (v - 0.5) * 2);
    else col = mix3(INK, PAPER, v);
    a[i] = col[0]; a[i + 1] = col[1]; a[i + 2] = col[2]; a[i + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  return c;
}
const mix3 = (A, B, p) => [A[0] + (B[0] - A[0]) * p, A[1] + (B[1] - A[1]) * p, A[2] + (B[2] - A[2]) * p];

function deckledPath(g, x, y, w, h, amp, seed) {
  const r = rng(seed); const pts = [];
  const step = Math.max(6, (w + h) / 90);
  const side = (x0, y0, x1, y1, nx, ny) => {
    const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(len / step));
    for (let i = 0; i < n; i++) { const p = i / n; const j = (r() - 0.5) * 2 * amp + noise(i * 0.7, seed) * amp * 0.6; pts.push([x0 + (x1 - x0) * p + nx * j, y0 + (y1 - y0) * p + ny * j]); }
  };
  side(x, y, x + w, y, 0, -1); side(x + w, y, x + w, y + h, 1, 0); side(x + w, y + h, x, y + h, 0, 1); side(x, y + h, x, y, -1, 0);
  g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b))); g.closePath();
}

/**
 * Cópia impressa: foto tratada dentro de uma borda de papel recortada (deckle), com sombra chapada.
 * Devolve { el (canvas posicionável), w, h (tamanho visível do papel em px CSS), inner {x,y,w,h} relativo ao papel, pad }.
 */
export function makePrint(img, { h, ratio, focus, tone, border = 0.045, seed = 3, shadow = true } = {}) {
  const r = ratio ?? img.naturalWidth / img.naturalHeight;
  const ph = h, pw = h * r;                               // área da foto
  const b = Math.round(ph * border);
  const ow = pw + b * 2, oh = ph + b * 2;
  const pad = Math.ceil(u * 1.4);
  const c = document.createElement('canvas');
  c.width = Math.round((ow + pad * 2) * DPR); c.height = Math.round((oh + pad * 2) * DPR);
  const g = c.getContext('2d'); g.scale(DPR, DPR);
  const amp = Math.max(1.2, oh * 0.0035);
  if (shadow) { g.save(); g.translate(pad + u * 0.35, pad + u * 0.45); deckledPath(g, 0, 0, ow, oh, amp, seed); g.fillStyle = 'rgba(22,20,18,.16)'; g.fill(); g.restore(); }
  g.save(); g.translate(pad, pad); deckledPath(g, 0, 0, ow, oh, amp, seed); g.fillStyle = `rgb(${BORDER})`; g.fill(); g.restore();
  const photo = treat(img, pw * DPR, ph * DPR, { ratio: r, focus, tone });
  g.drawImage(photo, pad + b, pad + b, pw, ph);
  Object.assign(c.style, { position: 'absolute', width: px(ow + pad * 2), height: px(oh + pad * 2), left: px(-pad), top: px(-pad) });
  const wrap = el('div', 'print');
  Object.assign(wrap.style, { width: px(ow), height: px(oh) });
  wrap.appendChild(c);
  return { el: wrap, w: ow, h: oh, inner: { x: b, y: b, w: pw, h: ph }, pad, border: b };
}

function alphaFromMask(mask, w, h, img, ratio, focus) {
  const c = document.createElement('canvas'); c.width = Math.round(w); c.height = Math.round(h);
  const g = c.getContext('2d');
  const s = srcRect(img, ratio, focus);
  g.drawImage(mask, s.sx, s.sy, s.sw, s.sh, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) { const a = d.data[i]; d.data[i] = d.data[i + 1] = d.data[i + 2] = 0; d.data[i + 3] = clamp((a - 20) * 1.15, 0, 255); }
  g.putImageData(d, 0, 0);
  return c;
}
function dilate(alpha, rb, color) {
  const c = document.createElement('canvas'); c.width = alpha.width; c.height = alpha.height;
  const g = c.getContext('2d');
  for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; g.drawImage(alpha, Math.cos(a) * rb, Math.sin(a) * rb); g.drawImage(alpha, Math.cos(a) * rb * 0.5, Math.sin(a) * rb * 0.5); }
  g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  return c;
}
/**
 * Recorte com borda de papel (figura sem fundo). mode: 'photo' (duotone) | 'silhouette' (papel chapado em tinta).
 * Devolve { el, w, h } com w/h = área da imagem original na escala (o canvas tem folga para borda e sombra).
 */
export function makeCutout(img, mask, { h, ratio, focus, mode = 'photo', tone, borderPx, shadow = true } = {}) {
  const r = ratio ?? img.naturalWidth / img.naturalHeight;
  const ih = h, iw = h * r;
  const rb = borderPx ?? Math.max(2, ih * 0.009);
  const pad = Math.ceil(rb * 2 + u * 1.4);
  const W2 = Math.round((iw + pad * 2) * DPR), H2 = Math.round((ih + pad * 2) * DPR);
  const alpha0 = alphaFromMask(mask, iw * DPR, ih * DPR, img, r, focus);
  const alpha = document.createElement('canvas'); alpha.width = W2; alpha.height = H2;
  alpha.getContext('2d').drawImage(alpha0, pad * DPR, pad * DPR);
  const border = dilate(alpha, rb * DPR, `rgb(${BORDER})`);
  const c = document.createElement('canvas'); c.width = W2; c.height = H2;
  const g = c.getContext('2d');
  if (shadow) {
    const sh = dilate(alpha, rb * DPR, 'rgba(22,20,18,.17)');
    g.drawImage(sh, u * 0.4 * DPR, u * 0.5 * DPR);
  }
  g.drawImage(border, 0, 0);
  const fig = document.createElement('canvas'); fig.width = W2; fig.height = H2;
  const fg = fig.getContext('2d');
  if (mode === 'silhouette') { fg.fillStyle = `rgb(${INK})`; fg.fillRect(0, 0, W2, H2); }
  else fg.drawImage(treat(img, iw * DPR, ih * DPR, { ratio: r, focus, tone }), pad * DPR, pad * DPR);
  fg.globalCompositeOperation = 'destination-in'; fg.drawImage(alpha, 0, 0);
  g.drawImage(fig, 0, 0);
  Object.assign(c.style, { position: 'absolute', width: px(iw + pad * 2), height: px(ih + pad * 2), left: px(-pad), top: px(-pad) });
  const wrap = el('div', 'print'); Object.assign(wrap.style, { width: px(iw), height: px(ih) }); wrap.appendChild(c);
  return { el: wrap, w: iw, h: ih, pad };
}

/** Cor média original de uma região da foto (amostra real, para a paleta da cena Identidade). */
export function sampleColor(img, cx, cy, rad = 6) {
  const c = document.createElement('canvas'); c.width = rad * 2; c.height = rad * 2;
  const g = c.getContext('2d'); g.drawImage(img, cx - rad, cy - rad, rad * 2, rad * 2, 0, 0, rad * 2, rad * 2);
  const d = g.getImageData(0, 0, rad * 2, rad * 2).data; let r = 0, gg = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
  return [Math.round(r / n), Math.round(gg / n), Math.round(b / n)];
}

// ------------------------------------------------------------------ cursor
export function makeCursor(parent) {
  const s = u * (P ? 4.2 : 3.2);
  const c = el('div', 'cursor', parent, `<svg viewBox="0 0 40 48" width="${s}" height="${s * 1.2}"><path d="M4 3 L4 37 L13 29 L19 44 L25.5 41.5 L19.5 27 L32 27 Z" fill="#161412" stroke="#F7F3EC" stroke-width="2.4" stroke-linejoin="round"/></svg>`);
  const ring = el('div', 'ring', parent);
  return {
    /** keys: [[t, x, y], ...]; clicks: [t...] */
    seek(t, keys, clicks = []) {
      const kf = keys.map(([tt, x, y]) => [tt, [x, y]]);
      const pos = (tt) => {   // track com mola entre alvos (posição contínua)
        let v = kf[0][1];
        for (let i = 1; i < kf.length; i++) { if (tt <= kf[i][0]) break; const p = springProgress(tt - kf[i][0], { stiffness: 120, damping: 22 }); v = [v[0] + (kf[i][1][0] - kf[i - 1][1][0]) * p, v[1] + (kf[i][1][1] - kf[i - 1][1][1]) * p]; }
        return v;
      };
      const v = pos(t);
      let sc = 1, rp = -1, rc = 0;
      for (const ct of clicks) { const d = t - ct; if (d >= -0.06 && d < 0.3) sc = Math.min(sc, 1 - 0.16 * Math.exp(-Math.abs(d) * 18)); if (d >= 0 && d < 0.45) { rp = d; rc = ct; } }
      c.style.transform = `translate(${v[0]}px,${v[1]}px) scale(${sc})`;
      if (rp >= 0) { const q = springProgress(rp, 'snappy'); const at = pos(rc); ring.style.display = 'block'; ring.style.transform = `translate(${at[0]}px,${at[1]}px) translate(-50%,-50%) scale(${0.3 + q * 0.9})`; ring.style.opacity = String(1 - clamp(rp / 0.45)); }
      else ring.style.display = 'none';
      return v;
    },
    el: c,
  };
}
