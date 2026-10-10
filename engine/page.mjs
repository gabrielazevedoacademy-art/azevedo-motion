// Infra compartilhada por render e critique: servidor estático local + abertura de página pronta para seek().
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, FORMATS } from './bin.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
};

/** Serve a raiz do repositório (vídeos importam /lib/*.js e /node_modules/@fontsource/*). */
export function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
      const file = path.join(ROOT, path.normalize(url));
      if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) {
        res.writeHead(404); res.end('404'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

// Injetado antes de qualquer script do vídeo: congela o relógio e denuncia fontes de não-determinismo.
const DETERMINISM_GUARD = `
(() => {
  const warn = new Set();
  const w = (k, m) => { if (!warn.has(k)) { warn.add(k); console.warn('[determinismo] ' + m); } };
  let s = 1337;
  Math.random = () => { w('random', 'Math.random sem semente — use rng(seed) de lib/motion.js'); s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  window.requestAnimationFrame = () => { w('raf', 'requestAnimationFrame ignorado — desenhe tudo em seek(t)'); return 0; };
  const _st = window.setTimeout; window.setTimeout = (f, ms, ...a) => { if (ms > 0) w('timeout', 'setTimeout com atraso — não dependa de relógio'); return _st(f, 0, ...a); };
  Date.now = () => 0; performance.now = () => 0;
  document.addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style');
    st.textContent = '*,*::before,*::after{animation-play-state:paused!important;transition:none!important;caret-color:transparent!important}';
    document.head.appendChild(st);
  });
})();`;

/** Abre videos/<nome>/index.html no formato pedido e espera fontes, imagens e window.seek. */
export async function openVideoPage(browser, { port, videoDir, format, scale = 1 }) {
  const f = FORMATS[format];
  if (!f) throw new Error(`Formato inválido: ${format} (use 16:9, 9:16, 1:1)`);
  const context = await browser.newContext({ viewport: { width: f.w, height: f.h }, deviceScaleFactor: scale });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`  [página ${m.type()}] ${m.text()}`); });
  page.on('requestfailed', (r) => console.log(`  [falha de rede] ${r.url()}`));
  await page.addInitScript(DETERMINISM_GUARD);
  const rel = path.relative(ROOT, path.resolve(videoDir)).split(path.sep).join('/');
  await page.goto(`http://127.0.0.1:${port}/${rel}/index.html?format=${encodeURIComponent(format)}`, { waitUntil: 'load' });
  try {
    await page.waitForFunction(() => typeof window.seek === 'function' && Number(window.DURATION) > 0, null, { timeout: 15000 });
  } catch {
    throw new Error(`index.html não expôs window.seek/window.DURATION.${errors.length ? ' Erros: ' + errors.join(' | ') : ''}`);
  }
  await page.evaluate(async () => {
    if (window.READY) await window.READY; // promessa opcional do vídeo (ex.: carregar texturas)
    await document.fonts.ready;
    await Promise.all([...document.images].map((im) => im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; })));
    await Promise.all([...document.images].map((im) => im.decode?.().catch(() => {})));
  });
  if (errors.length) throw new Error('Erro na página: ' + errors.join(' | '));
  const meta = await page.evaluate(() => ({
    duration: Number(window.DURATION),
    scenes: Array.isArray(window.SCENES) ? window.SCENES : null,
    poster: window.POSTER_T != null ? Number(window.POSTER_T) : null,
  }));
  return { page, context, meta, errors, size: f };
}

export async function seekTo(page, t) {
  await page.evaluate(async (tt) => { await window.seek(tt); }, t);
}

const BOOL_FLAGS = new Set(['preview', 'png']);
export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = !BOOL_FLAGS.has(k) && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      out[k] = v;
    } else out._.push(a);
  }
  return out;
}

export { launchBrowser, FORMATS };
