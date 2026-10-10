#!/usr/bin/env node
// Verifica determinismo: seek(t) em ordem embaralhada precisa gerar pixels idênticos.
// Uso: npm run check -- videos/<nome> [--format 16:9] [--samples 6]
import { startServer, openVideoPage, seekTo, parseArgs, launchBrowser } from './page.mjs';
import { rng } from '../lib/motion.js';

const args = parseArgs(process.argv.slice(2));
const videoDir = args._[0];
if (!videoDir) { console.error('Uso: npm run check -- videos/<nome>'); process.exit(1); }
const { server, port } = await startServer();
const browser = await launchBrowser();
let bad = 0;
try {
  const { page, meta } = await openVideoPage(browser, { port, videoDir, format: String(args.format || '16:9'), scale: 0.5 });
  const r = rng(5), n = Number(args.samples || 6);
  const times = Array.from({ length: n }, () => +(r() * meta.duration).toFixed(3));
  const first = new Map();
  for (const t of times) { await seekTo(page, t); first.set(t, (await page.screenshot({ type: 'png' })).toString('base64')); }
  for (const t of [...times].reverse()) {
    await seekTo(page, Math.max(0, meta.duration - t)); // bagunça o estado
    await seekTo(page, t);
    const same = (await page.screenshot({ type: 'png' })).toString('base64') === first.get(t);
    if (!same) bad++;
    console.log(`  t=${t.toFixed(3)}s ${same ? '✓ idêntico' : '✗ DIFERENTE — seek(t) depende de estado anterior'}`);
  }
} finally { await browser.close(); server.close(); }
if (bad) { console.error(`✗ ${bad} frame(s) não determinísticos`); process.exit(1); }
console.log('✓ determinístico');
