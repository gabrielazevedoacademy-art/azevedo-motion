// Cenas do 07-abertura. Cada página é uma camada opaca de papel; cada cena desenha o quadro EXATO de t.
import { springProgress, clamp, lerp, rng, mixColor } from '/lib/motion.js';
import { fitText } from '/lib/layout.js';
import { WORDS } from '../tempos.js';
import {
  L, W, H, u, P, safe, $, el, wt, we, sp, px, box, headY, footY,
  makePage, camera, pageTurn, splitChars, riseChars, capTop, capHeight, maskedLine,
  makePrint, makeCutout, sampleColor, makeCursor,
} from './base.js';

const pagesRoot = $('pages');
const show = (e, on) => { e.style.display = on ? '' : 'none'; };
const tf = (e, x, y, r = 0, s = 1) => { e.style.transform = `translate(${x}px,${y}px) rotate(${r}deg) scale(${s})`; };
const place = (e, x, y) => Object.assign(e.style, { position: 'absolute', left: px(x), top: px(y) });
const bigSerifSize = (text, maxW, max) => {
  const probe = el('div', 'serif', document.body); probe.textContent = text; Object.assign(probe.style, { position: 'absolute', whiteSpace: 'nowrap', lineHeight: 1, left: '-9999px' });
  const s = fitText(probe, maxW, { max, min: 20 }); probe.remove(); return s;
};
const turnEdge = (page) => { const e = el('div', 'turnEdge', page); e.style.width = px(u * 1.4); return e; };
/** título de capítulo "Nº 0x" + palavra */
function chapterTitle(parent, no, word, { x, y, t0 }) {
  const nSize = P ? u * 6 : u * 5.2, wSize = P ? u * 13 : u * 13;
  const n = maskedLine(parent, `Nº ${no}`, { size: nSize, x, capY: y, by: 'words' });
  n.parts[0].style.color = 'var(--wine)';
  const wordCap = y + capHeight(nSize) + nSize * 0.55;
  const w = maskedLine(parent, word, { size: wSize, x, capY: wordCap });
  return {
    bottom: wordCap + capHeight(wSize),
    seek(t, tw) {
      n.parts.forEach((p, i) => { const q = sp(t - t0 - i * 0.06); p.style.transform = `translateY(${(1 - q) * 125}%)`; });
      riseChars(w.parts, t, tw, 0.016);
    },
  };
}

export async function buildScenes(IMG, MASK) {
  const scenes = [];

  // ================================================================ PÁGINA A — feed, rosto, estratégia
  {
    const A = makePage(pagesRoot);
    const lay = A.layer;
    const order = ['p02', 'p04', 'p01', 'p05', 'p03'];
    // --- tamanhos do feed
    const R = IMG.p01.naturalWidth / IMG.p01.naturalHeight;
    const wordSize = P ? u * 9.5 : u * 11;
    let feedPh, slots = [];
    const bf = 0.045;
    if (!P) {
      feedPh = box.h * 0.58;
      const pw = feedPh * R + feedPh * bf * 2, ph = feedPh * (1 + bf * 2);
      const gap = (box.w - pw * 5) / 4;
      const yOff = [0.035, -0.01, 0.05, 0.0, 0.025];
      order.forEach((k, i) => slots.push({ k, x: box.x + i * (pw + gap), y: box.y + box.h * 0.02 + yOff[i] * box.h, w: pw, h: ph }));
    } else {
      feedPh = (box.h - wordSize * 1.9 - u * 4) / 2 / (1 + bf * 2) * 0.96;
      const pw = feedPh * R + feedPh * bf * 2, ph = feedPh * (1 + bf * 2);
      const gap = u * 2.6;
      const row1 = ['p02', 'p04', 'p05'], row2 = ['p01', 'p03'];
      const w1 = pw * 3 + gap * 2, w2 = pw * 2 + gap;
      row1.forEach((k, i) => slots.push({ k, x: box.cx - w1 / 2 + i * (pw + gap), y: box.y + (i === 1 ? 0 : u * 1.5), w: pw, h: ph }));
      row2.forEach((k, i) => slots.push({ k, x: box.cx - w2 / 2 + i * (pw + gap), y: box.y + ph + gap + (i ? u * 1.2 : 0), w: pw, h: ph }));
    }
    const rot = { p02: -1.6, p04: 1.1, p01: -0.6, p05: 1.5, p03: -1.1 };
    // P01 é feito no tamanho do herói (cena 2) e reduzido no feed — nunca ampliado
    const heroPh = P ? box.h * 0.66 : box.h * 0.97;
    const prints = {};
    for (const s of slots) {
      const hh = s.k === 'p01' ? heroPh : feedPh;
      const pr = makePrint(IMG[s.k], { h: hh, seed: s.k.charCodeAt(2) * 7 });
      prints[s.k] = { ...pr, slot: s, scale: s.k === 'p01' ? feedPh / heroPh : 1 };
      pr.el.style.transformOrigin = '0 0';
      lay.appendChild(pr.el); place(pr.el, 0, 0);
    }
    // herói da cena 2
    const hero = prints.p01;
    const heroW = hero.w, heroH = hero.h;
    const heroX = P ? box.cx - heroW / 2 : box.x + box.w * 0.30 - heroW / 2;
    const heroY = P ? box.y : box.y + (box.h - heroH) / 2;
    // silhueta (papel chapado em tinta) exatamente sobre a figura
    const sil = makeCutout(IMG.p01, MASK.p01, { h: hero.inner.h, mode: 'silhouette' });
    lay.insertBefore(sil.el, hero.el);
    place(sil.el, heroX + hero.inner.x, heroY + hero.inner.y);
    // palavras do feed
    const feedBottom = Math.max(...slots.map((s) => s.y + s.h));
    const wordCap = P ? feedBottom + u * 3.5 : feedBottom + u * 6;
    const feedWords = [[4, 'crescem'], [6, 'fecham'], [10, 'vendem']];
    let wx = box.x;
    const fw = feedWords.map(([i, txt]) => {
      const m = maskedLine(lay, txt, { size: wordSize, x: wx, capY: wordCap, italic: true, by: 'words' });
      const w = m.width(); const o = { m, i, x: wx }; wx += w + wordSize * 0.42; return o;
    });
    if (P) { const total = wx - wordSize * 0.42 - box.x; fw.forEach((o) => { o.m.mask.style.left = px(parseFloat(o.m.mask.style.left) + (box.w - total) / 2); }); }
    // "rosto." riscado
    const rSize = P ? u * 12 : u * 15;
    const rx = P ? box.x + u * 2 : heroX + heroW + u * 7;
    const rCap = P ? heroY + heroH + u * 7 : box.cy - capHeight(rSize) * 0.4;
    const rosto = maskedLine(lay, 'rosto.', { size: rSize, x: rx, capY: rCap, italic: true });
    const strike = el('div', 'strike', lay);
    const rw = rosto.width();
    Object.assign(strike.style, { left: px(rx - rSize * 0.04), top: px(rCap + capHeight(rSize) * 0.42), width: px(rw + rSize * 0.02), height: px(Math.max(3, rSize * 0.055)) });

    // --- S3 ESTRATÉGIA (aprovada no style frame)
    const s3 = el('div', 'sub', lay);
    const lines = P ? ['ESTRA-', 'TÉGIA'] : ['ESTRATÉGIA'];
    const maxW = P ? safe.w * 0.9 : safe.w * 0.93;
    const size = Math.min(...lines.map((tx) => bigSerifSize(tx, maxW, P ? 420 : 520)));
    const capH = capHeight(size);
    const lineGap = size * 0.98;
    const blockH = capH + (lines.length - 1) * lineGap;
    const top0 = P ? safe.y + safe.h * 0.5 - blockH / 2 : H * 0.53 - blockH / 2;
    const chars = [];
    lines.forEach((txt, i) => {
      const m = el('div', 'mask', s3); const b = el('div', 'serif big', m); b.textContent = txt;
      b.style.fontSize = px(size); b.style.position = 'relative';
      const capTopY = top0 + i * lineGap;
      Object.assign(m.style, { left: px(safe.x - size * 0.02), top: px(capTopY - size * 0.30), height: px(size * 1.08), width: px(safe.w + size * 0.1) });
      b.style.top = px(size * 0.30 - capTop(size));
      chars.push(splitChars(b, txt));
    });
    const capTopInBox = capTop(size);
    for (const cs of chars) for (const c of cs) if (c.textContent === 'É') {
      c.style.position = 'relative';
      const win = el('span', null, c); const ext = size * 0.5;
      Object.assign(win.style, { position: 'absolute', left: 0, top: px(-ext), height: px(ext + capTopInBox - size * 0.004), overflow: 'hidden', width: '100%' });
      const g = el('span', null, win, 'É'); Object.assign(g.style, { position: 'absolute', left: 0, top: px(ext), color: 'var(--wine)' });
    }
    const baseY = top0 + (lines.length - 1) * lineGap + capH;
    const rule3 = el('div', 'wrule', s3);
    Object.assign(rule3.style, { left: px(safe.x), top: px(baseY + size * 0.16), width: px(safe.w), height: px(Math.max(2, u * 0.32)) });
    const leadSize = P ? u * 7.2 : u * 5.4;
    const lead = el('div', 'serif lead', s3); lead.style.fontSize = px(leadSize);
    const leadWords = [18, 19, 20, 21, 22].map((i) => { const s = el('span', null, lead); s.textContent = WORDS[i].w + ' '; s.style.whiteSpace = 'pre'; return { s, i }; });
    Object.assign(lead.style, { left: px(safe.x), top: px(top0 - size * 0.30 - leadSize * 1.25) });

    const tPush = 4.63;
    scenes.push({
      a: 0, b: 10.45, page: A.page,
      seek(t) {
        camera(A.cam, t, t < tPush ? 0 : t < 7.0 ? tPush : 7.0, { zoom: 0.016, seed: 2 });
        // grid sendo traçado no frame 0
        A.grid.cols.forEach((c, i) => { c.style.transform = `scaleY(${sp(t + 0.45 - i * 0.035)})`; });
        A.grid.rules.forEach((r, i) => { r.style.transform = `scaleX(${sp(t + 0.5 - i * 0.1)})`; });
        // ---- cena 1 + 2: cópias
        let k = 0;
        for (const s of slots) {
          const pr = prints[s.k];
          const tin = s.k === 'p04' ? -0.32 : -0.1 + (k++) * 0.17;
          const pin = sp(t - tin);
          let x = s.x, y = s.y + (1 - pin) * H * 0.62, r = rot[s.k] + (1 - pin) * (s.k === 'p04' ? -7 : 6), sc = pr.scale;
          if (s.k === 'p01') {
            const ph = sp(t - tPush);       // aproxima: vira herói
            x = lerp(x, heroX, ph); y = lerp(y, heroY, ph); r = lerp(r, 0, ph); sc = lerp(pr.scale, 1, ph);
          } else {
            const pe = sp(t - tPush - 0.02 - Math.abs(slots.indexOf(s) - 2) * 0.04);
            const dir = s.x + s.w / 2 < box.cx ? -1 : 1;
            x += dir * pe * W * 0.75; r += dir * pe * 8;
            if (P) y += (s.y < box.cy ? -1 : 1) * pe * H * 0.15;
          }
          tf(pr.el, x, y, r, sc);
          show(pr.el, pin > 0.001 && (s.k === 'p01' || sp(t - tPush) < 0.999));
        }
        // silhueta: a foto se recolhe de cima para baixo e revela o papel chapado
        const pw = sp(t - wt(17) + 0.02);
        hero.el.style.clipPath = pw > 0 ? `inset(${pw * 106}% -10% -10% -10%)` : '';
        const out = sp(t - 6.98);           // tudo da cena 2 desce para fora
        show(sil.el, t >= wt(17) - 0.05 && out < 0.999);
        tf(sil.el, 0, out * H * 1.05, out * 3);
        if (pw >= 0.985) show(hero.el, false);
        // palavras do feed
        fw.forEach((o, j) => {
          const p = sp(t - wt(o.i));
          o.m.parts.forEach((pt) => { pt.style.transform = `translateY(${(1 - p) * 125}%)`; });
          const next = fw[j + 1] ? sp(t - wt(fw[j + 1].i)) : 0;
          o.m.inner.style.color = mixColor('#161412', '#9a938a', next);
          const ex = sp(t - tPush - 0.05);
          o.m.mask.style.transform = `translateX(${-ex * W * 0.9}px)`;
          show(o.m.mask, ex < 0.999);
        });
        // "rosto." + risco vinho
        riseChars(rosto.parts, t, wt(17), 0.03);
        strike.style.transform = `scaleX(${sp(t - we(17) + 0.12)})`;
        rosto.mask.style.transform = `translateY(${sp(t - 6.93) * H * 1.05}px)`;
        strike.style.translate = `0 ${sp(t - 6.93) * H * 1.05}px`;
        show(rosto.mask, t > wt(17) - 0.1 && t < 7.9); show(strike, t > wt(17) && t < 7.9);
        // ---- cena 3: ESTRATÉGIA
        const on3 = t >= 6.9;
        show(s3, on3);
        if (on3) {
          for (const { s, i } of leadWords) { const p = sp(t - wt(i)); s.style.transform = `translateY(${(1 - p) * leadSize * 0.5}px)`; s.style.opacity = p > 0 ? Math.min(1, p * 2.2) : 0; }
          const pd = sp(t - wt(23));
          lead.style.color = pd > 0 ? `rgba(22,20,18,${1 - 0.45 * pd})` : '';
          chars.forEach((cs, li) => riseChars(cs, t, wt(23) - 0.05 + li * 0.16, 0.03));
          rule3.style.transform = `scaleX(${sp(t - wt(23) - 0.32)})`;
        }
      },
    });
  }

  // ================================================================ PÁGINA B — título da revista ("No Influencer com IA … do zero")
  {
    const Bp = makePage(pagesRoot); const lay = Bp.layer; const edge = turnEdge(Bp.page);
    const T0 = 9.40;
    const fig = makeCutout(IMG.p02, MASK.p02, { h: P ? box.h * 0.7 : box.h * 1.04 });
    const figX = P ? box.r - fig.w * 0.92 : box.r - fig.w * 0.95, figY = box.b - fig.h + (P ? 0 : u * 1);
    const bigSize = bigSerifSize('Influencer', P ? safe.w * 0.97 : box.w * 0.66, 460);
    const bigCap = P ? box.y + u * 1.5 : box.y + box.h * 0.16;
    const big = maskedLine(lay, 'Influencer', { size: bigSize, x: box.x, capY: bigCap });
    lay.appendChild(fig.el); place(fig.el, figX, figY);
    const bigW = big.width();
    const comSize = bigSize * 0.5;
    const comCap = bigCap + capHeight(bigSize) + comSize * 0.55;
    const com = maskedLine(lay, 'com IA', { size: comSize, x: 0, capY: comCap, italic: true, by: 'words' });
    lay.insertBefore(com.mask, fig.el);
    const comW = com.width();
    com.mask.style.left = px(P ? box.x : box.x + bigW - comW - bigSize * 0.02);
    const zSize = P ? u * 9 : u * 8.5;
    const zCap = box.b - capHeight(zSize) - u * (P ? 2 : 1.5);
    const zero = maskedLine(lay, 'do zero.', { size: zSize, x: box.x, capY: zCap, italic: true, by: 'words' });
    const zr = el('div', 'wrule', lay);
    Object.assign(zr.style, { left: px(box.x), top: px(zCap - zSize * 0.42), width: px(zero.width() * 0.9), height: px(Math.max(2, u * 0.3)) });
    scenes.push({
      a: T0, b: 13.75, page: Bp.page,
      seek(t) {
        pageTurn(Bp.page, edge, t, T0);
        camera(Bp.cam, t, T0, { seed: 5 });
        riseChars(big.parts, t, wt(25), 0.03);
        com.parts.forEach((p, i) => { const q = sp(t - wt(i ? 27 : 26)); p.style.transform = `translateY(${(1 - q) * 125}%)`; });
        const pf = sp(t - T0 - 0.25);
        tf(fig.el, 0, (1 - pf) * H * 0.5, 0, 1);
        zero.parts.forEach((p, i) => { const q = sp(t - wt(i ? 32 : 31)); p.style.transform = `translateY(${(1 - q) * 125}%)`; });
        zr.style.transform = `scaleX(${sp(t - wt(32) - 0.2)})`;
      },
    });
  }

  // ================================================================ PÁGINA C — Nº 01 Público
  {
    const C = makePage(pagesRoot); const lay = C.layer; const edge = turnEdge(C.page);
    const T0 = 12.80;
    const title = chapterTitle(lay, '01', 'Público', { x: box.x, y: box.y + u * (P ? 1 : 4), t0: T0 + 0.12 });
    const ph = P ? box.h * 0.42 : box.h * 0.9;
    const pr = makePrint(IMG.p05, { h: ph, seed: 51 });
    lay.appendChild(pr.el);
    const prX = P ? box.cx - pr.w / 2 : box.r - pr.w - u * 2, prY = P ? title.bottom + u * 4 : box.y + (box.h - pr.h) / 2;
    place(pr.el, prX, prY);
    // matriz de pontos (público) — um grupo vira vinho em "público"
    const cols = P ? 12 : 13, rows = P ? 4 : 5;
    const mw = P ? box.w : box.w * 0.46, mx = box.x;
    const my = P ? prY + pr.h + u * 4.5 : title.bottom + u * 8;
    const cell = mw / cols, dsz = cell * 0.42;
    const dots = [];
    const r = rng(17);
    const cxS = cols * 0.62, cyS = rows * 0.45;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const d = el('div', 'dot', lay);
      Object.assign(d.style, { left: px(mx + i * cell + (cell - dsz) / 2), top: px(my + j * cell + (cell - dsz) / 2), width: px(dsz), height: px(dsz) });
      const dist = Math.hypot((i - cxS) / 1.25, j - cyS) + (r() + 1) * 0.4;
      dots.push({ d, i, j, sel: dist < 2.0 });
    }
    scenes.push({
      a: T0, b: 15.25, page: C.page,
      seek(t) {
        pageTurn(C.page, edge, t, T0);
        camera(C.cam, t, T0, { seed: 9 });
        title.seek(t, wt(37));
        for (const o of dots) {
          const q = springProgress(t - T0 - 0.2 - (o.i + o.j) * 0.018, 'snappy');
          const hi = sp(t - wt(37) - (o.sel ? 0.02 * o.i : 0));
          o.d.style.transform = `scale(${q * (o.sel ? 1 + 0.25 * hi : 1 - 0.15 * hi)})`;
          o.d.style.background = o.sel ? mixColor('#161412', '#7B2431', hi) : mixColor('#161412', '#BDB5A8', hi);
        }
      },
    });
  }

  // ================================================================ PÁGINA D — Nº 02 Identidade
  {
    const D = makePage(pagesRoot); const lay = D.layer; const edge = turnEdge(D.page);
    const T0 = 14.27;
    const title = chapterTitle(lay, '02', 'Identidade', { x: box.x, y: box.y + u * (P ? 1 : 4), t0: T0 + 0.12 });
    const img = IMG.p03, iw = img.naturalWidth, ih = img.naturalHeight;
    const ph = P ? box.h * 0.5 : box.h * 0.92;
    const pr = makePrint(img, { h: ph, seed: 33 });
    lay.appendChild(pr.el);
    const prX = P ? box.r - pr.w - u * 1 : box.x + box.w * 0.55, prY = P ? title.bottom + u * 3 : box.y + (box.h - pr.h) / 2;
    place(pr.el, prX, prY);
    const toPage = ([x, y]) => [prX + pr.inner.x + (x / iw) * pr.inner.w, prY + pr.inner.y + (y / ih) * pr.inner.h];
    const spots = [[488, 486], [428, 632], [420, 760]];          // vinho do debrum · rosa da estampa · creme do tecido
    const colors = spots.map(([x, y]) => sampleColor(img, x, y, 5));
    const clicks = [14.70, 15.00, 15.29];
    // lupa com a cor ORIGINAL da foto no ponto clicado
    const lr = u * (P ? 3.8 : 2.8);
    const loupes = spots.map(([sx, sy]) => {
      const c = document.createElement('canvas'); const d = Math.round(lr * 2 * (window.devicePixelRatio || 1));
      c.width = c.height = d; const g = c.getContext('2d');
      const k = (pr.inner.w / iw);                                   // px de página por px de foto
      const srcR = lr / k / 1.6;                                      // lupa com leve ampliação
      g.beginPath(); g.arc(d / 2, d / 2, d / 2, 0, Math.PI * 2); g.clip();
      g.drawImage(img, sx - srcR, sy - srcR, srcR * 2, srcR * 2, 0, 0, d, d);
      const w = el('div', 'loupe', lay); w.appendChild(c);
      Object.assign(c.style, { width: px(lr * 2), height: px(lr * 2) });
      const [x, y] = toPage([sx, sy]); place(w, x - lr, y - lr); Object.assign(w.style, { width: px(lr * 2), height: px(lr * 2) });
      return w;
    });
    // paleta (amostras reais) + tipografia
    const sw = P ? u * 8.5 : u * 9.5, sg = sw * 0.32;
    const palY = P ? prY + u * 2 : title.bottom + u * 7;
    const palX = box.x;
    const swatches = colors.map((c, i) => {
      const s = el('div', 'swatch', lay);
      if (P) Object.assign(s.style, { left: px(palX), top: px(palY + i * (sw + sg)), width: px(sw), height: px(sw), background: `rgb(${c})` });
      else Object.assign(s.style, { left: px(palX + i * (sw + sg)), top: px(palY), width: px(sw), height: px(sw), background: `rgb(${c})` });
      return s;
    });
    const tileW = P ? u * 17 : u * 15.5, tileH = tileW * 0.82;
    const tyY = P ? palY + 3 * (sw + sg) + u * 2 : palY + sw + u * 5;
    const tiles = [['serif', 'Aa'], ['sans', 'Aa']].map(([k, txt], i) => {
      const tl = el('div', 'tile ' + k, lay);
      tl.innerHTML = `<span>${txt}</span>`;
      const x = P ? palX : palX + i * (tileW + u * 2.2), y = P ? tyY + i * (tileH + u * 2) : tyY;
      Object.assign(tl.style, { left: px(x), top: px(y), width: px(tileW), height: px(tileH), fontSize: px(tileH * 0.5) });
      return { tl, x, y };
    });
    const tick = el('div', 'wrule', lay);
    Object.assign(tick.style, { left: px(tiles[0].x), top: px(tiles[0].y + tileH + u * 0.8), width: px(tileW), height: px(Math.max(3, u * 0.4)) });
    const cur = makeCursor(lay);
    const sp1 = toPage(spots[0]), sp2 = toPage(spots[1]), sp3 = toPage(spots[2]);
    const tileC = [tiles[0].x + tileW * 0.55, tiles[0].y + tileH * 0.6];
    const keys = [[T0, W + u * 6, H * 0.8], [T0 + 0.05, sp1[0], sp1[1]], [clicks[0] + 0.06, sp2[0], sp2[1]], [clicks[1] + 0.06, sp3[0], sp3[1]], [clicks[2] + 0.12, tileC[0], tileC[1]], [16.1, tileC[0] + u * 6, tileC[1] + u * 5]];
    const tSel = 15.82;
    scenes.push({
      a: T0, b: 16.85, page: D.page,
      seek(t) {
        pageTurn(D.page, edge, t, T0);
        camera(D.cam, t, T0, { seed: 13 });
        title.seek(t, T0 + 0.2);
        loupes.forEach((lp, i) => { const q = springProgress(t - clicks[i], 'snappy') - springProgress(t - clicks[i] - 0.26, 'snappy'); lp.style.transform = `scale(${q})`; show(lp, q > 0.001); });
        swatches.forEach((s, i) => { const q = sp(t - clicks[i] - 0.1); s.style.transform = `scale(${q})`; });
        tiles.forEach(({ tl }, i) => {
          const q = sp(t - 15.25 - i * 0.08);
          tl.style.transform = `translateY(${(1 - q) * u * 3}px)`; tl.style.clipPath = `inset(0 0 ${(1 - q) * 100}% 0)`;
          const sel = sp(t - tSel);
          tl.style.color = i === 0 ? '' : mixColor('#161412', '#B3AB9F', sel);
          tl.style.borderColor = i === 0 ? mixColor('#C9C1B4', '#7B2431', sel) : '';
        });
        tick.style.transform = `scaleX(${sp(t - tSel - 0.05)})`;
        cur.seek(t, keys, [...clicks, tSel]);
      },
    });
  }

  // ================================================================ PÁGINA E — Nº 03 Conteúdo
  {
    const E = makePage(pagesRoot); const lay = E.layer; const edge = turnEdge(E.page);
    const T0 = 15.91;
    const title = chapterTitle(lay, '03', 'Conteúdo', { x: box.x, y: box.y + u * (P ? 1 : 4), t0: T0 + 0.12 });
    const fr = 0.8;
    const fw = P ? box.w * 0.46 : box.w * 0.2, fh = fw / fr, fgap = P ? box.w * 0.08 : u * 3;
    const fy = P ? title.bottom + u * 3.5 : box.y + u * 3;
    const fx0 = P ? box.x : box.x + box.w * 0.29;
    const frames = [0, 1].map((i) => { const f = el('div', 'frame', lay); Object.assign(f.style, { left: px(fx0 + i * (fw + fgap)), top: px(fy), width: px(fw), height: px(fh) }); return f; });
    const inner = fh / (1 + 0.045 * 2);
    const pImg = makePrint(IMG.p02, { h: inner, ratio: fr, focus: [0.5, 0.42], seed: 61 });
    const pVid = makePrint(IMG.p01, { h: inner, ratio: fr, focus: [0.5, 0.4], seed: 62 });
    for (const [pp, i] of [[pImg, 0], [pVid, 1]]) { lay.appendChild(pp.el); place(pp.el, fx0 + i * (fw + fgap) + (fw - pp.w) / 2, fy + (fh - pp.h) / 2); }
    // marcas de vídeo: perfuração de filme + play + barra de progresso
    const vx = fx0 + fw + fgap + (fw - pVid.w) / 2 + pVid.inner.x, vy = fy + (fh - pVid.h) / 2 + pVid.inner.y;
    const vid = el('div', 'vidmarks', lay);
    Object.assign(vid.style, { left: px(vx), top: px(vy), width: px(pVid.inner.w), height: px(pVid.inner.h) });
    const stripW = pVid.inner.w * 0.075;
    for (const side of ['left', 'right']) {
      const s = el('div', 'strip', vid); Object.assign(s.style, { [side]: 0, width: px(stripW) });
      const n = 12; for (let k = 0; k < n; k++) { const h = el('div', 'hole', s); Object.assign(h.style, { top: px((k + 0.3) * pVid.inner.h / n), height: px(pVid.inner.h / n * 0.42), left: px(stripW * 0.28), width: px(stripW * 0.44) }); }
    }
    const play = el('div', 'play', vid); const pd = pVid.inner.w * 0.2;
    Object.assign(play.style, { width: px(pd), height: px(pd), left: px((pVid.inner.w - pd) / 2), top: px((pVid.inner.h - pd) / 2) });
    play.innerHTML = `<svg viewBox="0 0 10 10" width="${pd * 0.42}" height="${pd * 0.42}"><path d="M2.2 1 L9 5 L2.2 9 Z" fill="#F7F3EC"/></svg>`;
    const bar = el('div', 'progress', vid); Object.assign(bar.style, { left: px(stripW * 1.3), right: px(stripW * 1.3), bottom: px(pVid.inner.h * 0.05), height: px(Math.max(3, u * 0.35)) });
    const barFill = el('div', 'fill', bar);
    // rótulos falados
    const lSize = P ? u * 6 : u * 5;
    const labY = fy + fh + lSize * (P ? 0.55 : 0.6);
    const lImg = maskedLine(lay, 'imagem', { size: lSize, x: fx0, capY: labY, italic: true });
    const lVid = maskedLine(lay, 'vídeo', { size: lSize, x: fx0 + fw + fgap, capY: labY, italic: true });
    // miniaturas (recortes das próprias fotos) = criação com IA
    const crops = [['p04', [0.5, 0.3]], ['p05', [0.42, 0.3]], ['p03', [0.5, 0.55]], ['p02', [0.5, 0.6]], ['p01', [0.5, 0.3]], ['p04', [0.55, 0.62]]];
    let tx0, ty0, tsz, tcols, tg;
    if (P) { tcols = 6; tg = u * 1.6; tsz = (box.w - tg * 5) / 6 / 1.09; tx0 = box.x; ty0 = labY + capHeight(lSize) + u * 4; }
    else { tcols = 2; tg = u * 2; tx0 = fx0 + 2 * (fw + fgap) + u * 1.5; tsz = ((box.r - tx0) - tg) / 2 / 1.09; ty0 = fy; }
    const thumbs = crops.map(([k, f], i) => {
      const pp = makePrint(IMG[k], { h: tsz, ratio: 1, focus: f, seed: 70 + i, border: 0.06 });
      lay.appendChild(pp.el);
      place(pp.el, tx0 + (i % tcols) * (pp.w + tg), ty0 + Math.floor(i / tcols) * (pp.h + tg));
      return pp;
    });
    const iaSize = P ? u * 4.6 : u * 4.2;
    const lastT = thumbs.at(-1);
    const iaCap = parseFloat(lastT.el.style.top) + lastT.h + iaSize * (P ? 0.9 : 0.75);
    const iaLines = P ? [['inteligência artificial', 52]] : [['inteligência', 52], ['artificial', 53]];
    const ia = iaLines.map(([txt, wi], k) => ({ m: maskedLine(lay, txt, { size: iaSize, x: tx0, capY: iaCap + k * iaSize * 1.1, italic: true, by: 'words' }), wi }));
    scenes.push({
      a: T0, b: 20.4, page: E.page,
      seek(t) {
        pageTurn(E.page, edge, t, T0);
        camera(E.cam, t, T0, { seed: 17 });
        title.seek(t, T0 + 0.2);
        frames.forEach((f, i) => { const q = sp(t - T0 - 0.25 - i * 0.08); f.style.clipPath = `inset(0 ${(1 - q) * 100}% ${(1 - q) * 100}% 0)`; });
        const pi = sp(t - wt(48) + 0.04), pv = sp(t - wt(50) + 0.04);
        tf(pImg.el, 0, -(1 - pi) * H * 0.35, -(1 - pi) * 4); show(pImg.el, pi > 0.001);
        tf(pVid.el, 0, -(1 - pv) * H * 0.35, (1 - pv) * 4); show(pVid.el, pv > 0.001);
        tf(vid, 0, -(1 - pv) * H * 0.35, 0); show(vid, pv > 0.001);
        barFill.style.transform = `scaleX(${clamp((t - wt(50) - 0.2) / 2.6)})`;
        riseChars(lImg.parts, t, wt(48), 0.03); riseChars(lVid.parts, t, wt(50), 0.03);
        thumbs.forEach((pp, i) => { const q = sp(t - wt(52) - i * 0.07); tf(pp.el, 0, (1 - q) * u * 6, 0, 0.9 + 0.1 * q); pp.el.style.clipPath = `inset(${(1 - q) * 100}% -20% -20% -20%)`; });
        ia.forEach(({ m, wi }) => m.parts.forEach((p, k) => { const q = sp(t - wt(wi + k)); p.style.transform = `translateY(${(1 - q) * 125}%)`; }));
      },
    });
  }

  // ================================================================ PÁGINA F — Renda: TikTok Shop · Parceria com marca · Seu próprio produto
  {
    const F = makePage(pagesRoot); const lay = F.layer;
    const T0 = 19.45;
    // frase de entrada (palavra por palavra) + RENDA
    const leadSize = P ? u * 7 : u * 7.2;
    const leadLines = P ? [[54, 55], [56, 57, 58, 59]] : [[54, 55, 56, 57, 58, 59]];
    const rSize = bigSerifSize('RENDA', P ? safe.w * 0.9 : box.w * 0.5, 520);
    const rCapH = capHeight(rSize);
    const leadH = leadLines.length * leadSize * 1.2;
    const blockTop = P ? box.y + box.h * 0.26 : box.y + box.h * 0.22;
    const leads = leadLines.map((idx, k) => {
      const m = maskedLine(lay, idx.map((i) => WORDS[i].w).join(' '), { size: leadSize, x: box.x, capY: blockTop + k * leadSize * 1.2, italic: true, by: 'words' });
      return { m, idx };
    });
    const rCap = blockTop + leadH + leadSize * 0.6;
    const renda = maskedLine(lay, 'RENDA', { size: rSize, x: box.x, capY: rCap });
    const rRule = el('div', 'wrule', lay);
    Object.assign(rRule.style, { left: px(box.x), top: px(rCap + rCapH + rSize * 0.14), width: px(box.w), height: px(Math.max(2, u * 0.32)) });
    // cabeçalho final: RENDA pequeno no topo
    const hSize = P ? u * 7 : u * 7.5;
    const hScale = hSize / rSize;
    const hCap = box.y + u * 0.5;
    const hDy = hCap - rCap;
    const colTop = hCap + capHeight(hSize) + u * (P ? 3.4 : 4.5);
    // colunas (16:9) ou linhas (9:16)
    const n = 3, gap = u * 3;
    const cells = [];
    for (let i = 0; i < n; i++) {
      if (!P) { const cw = (box.w - gap * 2) / 3; cells.push({ x: box.x + i * (cw + gap), y: colTop, w: cw, h: box.b - colTop }); }
      else { const rh = (box.b - colTop - gap * 2) / 3; cells.push({ x: box.x, y: colTop + i * (rh + gap), w: box.w, h: rh }); }
    }
    const tSize = P ? u * 5 : u * 4.4;
    const titles = [[[61, 62], 'TikTok Shop'], [[63, 64, 65], 'Parceria com marca'], [[68, 69, 70], 'Seu próprio produto']];
    const colTitles = titles.map(([idx, txt], i) => {
      const c = cells[i];
      const m = maskedLine(lay, txt, { size: tSize, x: c.x, capY: c.y + (P ? u * 1 : 0), by: 'words' });
      return { m, idx };
    });
    const rules = cells.slice(1).map((c) => {
      const r = el('div', P ? 'hline' : 'vline', lay);
      if (!P) Object.assign(r.style, { left: px(c.x - gap / 2), top: px(c.y), height: px(c.h) }); else Object.assign(r.style, { left: px(c.x), top: px(c.y - gap / 2), width: px(c.w) });
      return r;
    });
    const vis = cells.map((c) => (P ? { x: c.x + c.w * 0.36, y: c.y, w: c.w * 0.64, h: c.h } : { x: c.x, y: c.y + tSize * 1.25, w: c.w, h: c.h - tSize * 1.25 }));
    // col 1 — TikTok Shop: foto 02, clique na garrafa
    const v1 = vis[0];
    const R1 = 0.68, F1 = [0.5, 0.44];
    const p1h = (P ? v1.h * 0.98 : Math.min(v1.h * 0.96, v1.w / R1 * 0.92)) / 1.09;
    const pr1 = makePrint(IMG.p02, { h: p1h, ratio: R1, focus: F1, seed: 81 });
    lay.appendChild(pr1.el);
    const pr1x = P ? v1.x + v1.w - pr1.w : v1.x + (v1.w - pr1.w) / 2, pr1y = v1.y + (P ? 0 : (v1.h - pr1.h) / 2);
    place(pr1.el, pr1x, pr1y);
    // garrafa na foto 02: (247, 1030) em 941×1672 → no recorte 4:5 com foco (0.4, 0.6)
    const b2 = IMG.p02; const sh2 = b2.naturalWidth / R1; const sy2 = clamp(F1[1] * b2.naturalHeight - sh2 / 2, 0, b2.naturalHeight - sh2);
    const bot = [pr1x + pr1.inner.x + (247 / b2.naturalWidth) * pr1.inner.w, pr1y + pr1.inner.y + ((1030 - sy2) / sh2) * pr1.inner.h];
    const ringR = pr1.inner.w * 0.13;
    const pring = el('div', 'pring', lay); Object.assign(pring.style, { width: px(ringR * 2), height: px(ringR * 2.6), left: px(bot[0] - ringR), top: px(bot[1] - ringR * 1.3) });
    const cur = makeCursor(lay);
    const tClick = we(62) + 0.03;
    const keys = [[22.9, W + u * 5, bot[1] + u * 10], [23.15, bot[0] + u * 0.5, bot[1] + u * 0.5], [tClick + 0.35, bot[0] + u * 8, bot[1] + u * 7]];
    // col 2 — Parceria: foto 04 + contrato com assinatura
    const v2 = vis[1];
    const p2h = (P ? v2.h * 0.98 : v2.h * 0.62) / 1.09;
    const pr2 = makePrint(IMG.p04, { h: p2h, ratio: 0.8, focus: [0.55, 0.36], seed: 82 });
    lay.appendChild(pr2.el); const pr2x = v2.x + (P ? 0 : u * 0.5), pr2y = v2.y + (P ? 0 : u * 0.5); place(pr2.el, pr2x, pr2y);
    const shH = P ? v2.h * 0.98 : v2.h * 0.66, shW = shH * 0.74;
    const shX = P ? pr2x + pr2.w + u * 2 : v2.x + v2.w - shW - u * 0.5, shY = P ? v2.y : v2.y + v2.h - shH - u * 0.5;
    const sheet = el('div', 'sheet', lay); Object.assign(sheet.style, { left: px(shX), top: px(shY), width: px(shW), height: px(shH) });
    const rr = rng(23);
    for (let k = 0; k < 7; k++) { const b = el('div', 'tline', sheet); Object.assign(b.style, { left: px(shW * 0.12), top: px(shH * (0.12 + k * 0.075)), width: px(shW * (0.55 + (rr() + 1) * 0.15) * (k === 6 ? 0.6 : 1)), height: px(Math.max(2, shH * 0.018)) }); }
    const sigLine = el('div', 'sigline', sheet); Object.assign(sigLine.style, { left: px(shW * 0.12), width: px(shW * 0.76), top: px(shH * 0.83) });
    sheet.insertAdjacentHTML('beforeend', `<svg class="sig" viewBox="0 0 200 70" style="position:absolute;left:${shW * 0.14}px;top:${shH * 0.6}px;width:${shW * 0.7}px;height:${shW * 0.7 * 0.35}px"><path d="M6 52 C 18 20, 30 10, 34 30 S 30 62, 44 46 S 62 14, 70 34 S 74 58, 88 40 C 96 30, 104 30, 106 42 S 116 56, 128 36 S 146 18, 150 38 S 160 52, 176 30 L 194 22" fill="none" stroke="#161412" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
    const sigPath = sheet.querySelector('.sig path'); const sigLen = sigPath.getTotalLength();
    sigPath.style.strokeDasharray = `${sigLen}`;
    // col 3 — Seu próprio produto: capa de produto digital com a foto 05
    const v3 = vis[2];
    const cvH = P ? v3.h * 0.98 : Math.min(v3.h * 0.94, v3.w * 0.8 / 0.72), cvW = cvH * 0.72;
    const cvX = P ? v3.x + v3.w - cvW : v3.x + (v3.w - cvW) / 2, cvY = v3.y + (v3.h - cvH) / 2;
    const cover = el('div', 'cover', lay); Object.assign(cover.style, { left: px(cvX), top: px(cvY), width: px(cvW), height: px(cvH) });
    const spine = el('div', 'spine', cover); spine.style.width = px(cvW * 0.07);
    const cimgH = cvH * 0.6;
    const cimg = makePrint(IMG.p05, { h: cimgH, ratio: (cvW * 0.78) / cimgH, focus: [0.5, 0.32], border: 0, seed: 83, shadow: false });
    cover.appendChild(cimg.el); place(cimg.el, cvW * 0.15, cvH * 0.07);
    const ct = el('div', 'serif covertitle', cover, 'Influencer<br><i>com IA</i>');
    Object.assign(ct.style, { left: px(cvW * 0.15), top: px(cvH * 0.7) });
    fitText(ct, cvW * 0.74, { max: cvH * 0.12, min: 10, maxH: cvH * 0.26 });
    // transição de entrada (página desliza da direita)
    scenes.push({
      a: T0, b: 28.2, page: F.page,
      seek(t) {
        const pin = sp(t - T0);
        F.page.style.transform = pin < 0.999 ? `translateX(${(1 - pin) * W}px)` : '';
        camera(F.cam, t, T0, { seed: 21, zoom: 0.012 });
        // frase + RENDA, depois reorganiza como cabeçalho
        const up = sp(t - 22.82);
        leads.forEach(({ m, idx }) => {
          m.parts.forEach((p, k) => { const q = sp(t - wt(idx[k])); p.style.transform = `translateY(${(1 - q) * 125 - up * 170}%)`; });
          show(m.mask, up < 0.97);
        });
        riseChars(renda.parts, t, wt(60) - 0.04, 0.035);
        const s = lerp(1, hScale, up);
        renda.mask.style.transformOrigin = `${box.x - parseFloat(renda.mask.style.left)}px ${rCap - parseFloat(renda.mask.style.top)}px`;
        renda.mask.style.transform = `translateY(${hDy * up}px) scale(${s})`;
        rRule.style.transformOrigin = 'left';
        rRule.style.transform = `translateY(${(hCap + capHeight(hSize) + u * 1.6 - parseFloat(rRule.style.top)) * up}px) scaleX(${sp(t - wt(60) - 0.3)})`;
        // colunas
        rules.forEach((r, i) => { const q = sp(t - wt(61) + 0.1 - i * 0.08); r.style.transform = P ? `scaleX(${q})` : `scaleY(${q})`; });
        colTitles.forEach(({ m, idx }) => m.parts.forEach((p, k) => { const q = sp(t - wt(idx[k])); p.style.transform = `translateY(${(1 - q) * 125}%)`; }));
        const q1 = sp(t - wt(61) + 0.05);
        tf(pr1.el, 0, (1 - q1) * H * 0.4, (1 - q1) * 4); show(pr1.el, q1 > 0.001);
        const pc = springProgress(t - tClick, 'snappy');
        pring.style.transform = `scale(${pc})`; show(pring, pc > 0.001);
        show(cur.el, t > 22.85 && t < 25.5);
        cur.seek(t, keys, [tClick]);
        const q2 = sp(t - wt(63) + 0.05), q2b = sp(t - wt(63) - 0.12);
        tf(pr2.el, 0, (1 - q2) * H * 0.4, -(1 - q2) * 4); show(pr2.el, q2 > 0.001);
        tf(sheet, 0, (1 - q2b) * H * 0.4, (1 - q2b) * 5 + 1.2); show(sheet, q2b > 0.001);
        sigPath.style.strokeDashoffset = String(sigLen * (1 - clamp((t - wt(65)) / 0.95) ** 0.85));
        const q3 = sp(t - wt(68) + 0.02);
        cover.style.transform = `translateY(${(1 - q3) * H * 0.4}px) perspective(${u * 120}px) rotateY(${-14 + 8 * q3}deg) rotate(${(1 - q3) * 4 - 1.2}deg)`;
        show(cover, q3 > 0.001);
      },
    });
  }

  // ================================================================ PÁGINA G — Assinatura
  {
    const G = makePage(pagesRoot); const lay = G.layer;
    const T0 = 27.28;
    const lines = P ? ['Influencer', 'com IA'] : ['Influencer com IA'];
    const size = Math.min(bigSerifSize(lines[0], P ? safe.w * 0.95 : box.w * 0.84, 520), P ? 999 : 999);
    const capH = capHeight(size);
    const lg = size * 0.92;
    const blockH = capH + (lines.length - 1) * lg;
    const top0 = P ? box.y + box.h * 0.42 - blockH / 2 : box.y + box.h * 0.46 - blockH / 2;
    const ml = lines.map((txt, i) => maskedLine(lay, txt, { size, x: box.x, capY: top0 + i * lg, italic: i === 1 }));
    // "com IA" em itálico também no 16:9
    if (!P) { const cs = ml[0].parts; const iStart = 'Influencer '.length; cs.slice(iStart).forEach((c) => { c.style.fontStyle = 'italic'; }); }
    const baseY = top0 + blockH;
    const rule = el('div', 'wrule', lay);
    Object.assign(rule.style, { left: px(box.x), top: px(baseY + size * 0.2), width: px(box.w), height: px(Math.max(2, u * 0.35)) });
    const ac = el('div', 'academy', lay, 'Azevedo Academy');
    const acSize = P ? u * 3.2 : u * 2.6;
    Object.assign(ac.style, { left: px(box.x), top: px(baseY + size * 0.2 + u * 3), fontSize: px(acSize) });
    const arH = P ? u * 13 : u * 10.5;
    const arrow = el('div', 'arrow', lay, `<svg viewBox="0 0 40 100" width="${arH * 0.4}" height="${arH}"><path d="M20 2 V94" stroke="#161412" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M6 80 L20 96 L34 80" stroke="#161412" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
    place(arrow, box.r - arH * 0.4 - u * 1, baseY + size * 0.2 + u * 2.4);
    const arPaths = [...arrow.querySelectorAll('path')]; const arLen = arPaths.map((p) => p.getTotalLength());
    arPaths.forEach((p, i) => { p.style.strokeDasharray = `${arLen[i]}`; });
    scenes.push({
      a: T0, b: 30.01, page: G.page,
      seek(t) {
        const p = sp((t - T0) * 1.1);
        G.page.style.clipPath = p < 0.999 ? `inset(${(1 - p) * 100}% 0 0 0)` : '';
        camera(G.cam, t, T0, { seed: 25, zoom: 0.014 });
        ml.forEach((m, i) => riseChars(m.parts, t, wt(71) - 0.02 + i * 0.12, 0.028));
        rule.style.transform = `scaleX(${sp(t - wt(71) - 0.35)})`;
        const pa = sp(t - wt(71) - 0.6);
        ac.style.clipPath = `inset(0 ${(1 - pa) * 100}% 0 0)`;
        const d1 = clamp((t - wt(72)) / 0.55), d2 = clamp((t - wt(72) - 0.42) / 0.3);
        arPaths[0].style.strokeDashoffset = String(arLen[0] * (1 - sp(d1 * 0.9)));
        arPaths[1].style.strokeDashoffset = String(arLen[1] * (1 - sp(d2 * 0.9)));
        const bob = Math.sin((t - wt(75)) * 3.2) * u * 0.7 * sp(t - wt(75));
        arrow.style.transform = `translateY(${t > wt(75) ? bob + u * 0.7 * sp(t - wt(75)) : 0}px)`;
      },
    });
  }

  return scenes;
}
