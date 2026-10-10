#!/usr/bin/env node
// Renderizador determinístico: Chromium headless → seek(t) frame a frame → pipe → ffmpeg (H.264).
// Uso: npm run render -- videos/<nome> [--fps 60] [--format 16:9|9:16|1:1|all] [--workers 4]
//      npm run preview -- videos/<nome> [--format ...]   (30 fps, metade da resolução)
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { FFMPEG } from './bin.mjs';
import { startServer, openVideoPage, seekTo, parseArgs, launchBrowser, FORMATS } from './page.mjs';

const args = parseArgs(process.argv.slice(2));
const videoDir = args._[0];
if (!videoDir || !existsSync(path.join(videoDir, 'index.html'))) {
  console.error('Uso: npm run render -- videos/<nome> [--fps 60] [--format 16:9|9:16|1:1|all]');
  process.exit(1);
}
const preview = !!args.preview;
const fps = Number(args.fps || (preview ? 30 : 60));
const scale = preview ? 0.5 : 1;
const fmtArg = String(args.format || '16:9');
const formats = fmtArg === 'all' ? Object.keys(FORMATS) : fmtArg.split(',');
const workers = Math.max(1, Number(args.workers || Math.min(6, Math.max(2, os.cpus().length - 1))));
const crf = Number(args.crf || (preview ? 26 : 17));
const audioPath = path.join(videoDir, 'audio.wav');
const outDir = path.join(videoDir, 'out');
mkdirSync(outDir, { recursive: true });

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function startEncoder(outFile, w, h, duration) {
  const a = ['-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', 'pipe:0'];
  const hasAudio = existsSync(audioPath);
  if (hasAudio) a.push('-i', audioPath);
  a.push('-map', '0:v:0');
  if (hasAudio) a.push('-map', '1:a:0');
  a.push('-vf', `scale=${w}:${h}:flags=lanczos,format=yuv420p`,
    '-c:v', 'libx264', '-preset', preview ? 'veryfast' : 'slow', '-crf', String(crf),
    '-profile:v', 'high', '-level:v', fps > 30 ? '4.2' : '4.1', '-pix_fmt', 'yuv420p',
    '-r', String(fps), '-g', String(fps), '-bf', '2', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709');
  if (hasAudio) a.push('-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-af', 'apad', '-t', String(duration));
  a.push('-movflags', '+faststart', outFile);
  const p = spawn(FFMPEG, a, { stdio: ['pipe', 'inherit', 'inherit'] });
  p.stdin.on('error', (e) => console.error('\n✗ pipe do ffmpeg:', e.message));
  const done = new Promise((res, rej) => p.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg saiu com código ${c}`)))));
  return { stdin: p.stdin, done, hasAudio };
}

function write(stream, buf) {
  return new Promise((res) => {
    if (stream.write(buf)) res(); else stream.once('drain', res);
  });
}

async function renderFormat(browser, port, format) {
  const t0 = Date.now();
  const f = FORMATS[format];
  const pages = [];
  for (let i = 0; i < workers; i++) pages.push(await openVideoPage(browser, { port, videoDir, format, scale }));
  const { duration, poster } = pages[0].meta;
  const total = Math.round(duration * fps);
  const w = Math.round(f.w * scale / 2) * 2, h = Math.round(f.h * scale / 2) * 2;
  const outFile = path.join(outDir, `${preview ? 'preview' : 'final'}_${f.slug}.mp4`);
  console.log(`▸ ${format} ${w}x${h} @${fps}fps · ${duration}s · ${total} frames · ${workers} workers`);
  const enc = startEncoder(outFile, w, h, duration);

  // Cada worker captura frames i ≡ k (mod workers); a escrita no pipe é sempre em ordem.
  const results = new Map();
  let next = 0, lastLog = 0;
  const waiters = new Map();
  const capture = async (k) => {
    const { page } = pages[k];
    for (let i = k; i < total; i += workers) {
      while (i - next > workers * 4) await new Promise((r) => waiters.set(k, r)); // backpressure
      await seekTo(page, i / fps);
      const buf = await page.screenshot({ type: 'jpeg', quality: preview ? 85 : 97, animations: 'disabled', caret: 'hide' });
      results.set(i, buf);
      flushPending();
    }
  };
  let flushing = Promise.resolve();
  const flushPending = () => {
    flushing = flushing.then(async () => {
      while (results.has(next)) {
        const buf = results.get(next); results.delete(next);
        await write(enc.stdin, buf); next++;
        for (const [k, r] of waiters) { waiters.delete(k); r(); }
        const now = Date.now();
        if (now - lastLog > 1000 || next === total) {
          lastLog = now;
          const el = (now - t0) / 1000, rate = next / el;
          process.stdout.write(`\r  ${String(Math.round(next / total * 100)).padStart(3)}% ${next}/${total} · ${rate.toFixed(1)} fps · resta ${fmtTime((total - next) / Math.max(rate, 0.01))}   `);
        }
      }
    });
  };
  await Promise.all(pages.map((_, k) => capture(k)));
  await flushing;
  enc.stdin.end();
  await enc.done;
  process.stdout.write('\n');

  // Pôster (do primeiro formato renderizado em resolução cheia)
  if (!preview && format === formats[0]) {
    const pt = poster ?? duration * 0.5;
    const pp = await openVideoPage(browser, { port, videoDir, format, scale: 1 });
    await seekTo(pp.page, pt);
    await pp.page.screenshot({ path: path.join(videoDir, 'poster.png'), type: 'png' });
    await pp.context.close();
    console.log(`  pôster: ${path.join(videoDir, 'poster.png')} (t=${pt.toFixed(2)}s)`);
  }
  for (const p of pages) await p.context.close();
  const mb = statSync(outFile).size / 1e6;
  console.log(`  ✓ ${outFile} · ${mb.toFixed(1)} MB · ${enc.hasAudio ? 'com áudio' : 'sem áudio'} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (mb > 90) console.warn('  ⚠ acima de 90 MB — rode novamente com --crf 21 (ou maior)');
  return outFile;
}

const T0 = Date.now();
const { server, port } = await startServer();
const browser = await launchBrowser();
try {
  for (const fmt of formats) await renderFormat(browser, port, fmt);
} catch (e) {
  console.error('\n✗', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
if (!process.exitCode) console.log(`✓ Tempo total: ${((Date.now() - T0) / 1000).toFixed(1)}s`);
