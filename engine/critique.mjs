#!/usr/bin/env node
// Crítica visual: extrai N frames (um por cena se window.SCENES existir) e monta contact_sheet.png com timestamps.
// Uso: npm run critique -- videos/<nome> [--frames 8] [--format 16:9|9:16|1:1|all] [--at 0.5,2,3.2]
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { startServer, openVideoPage, seekTo, parseArgs, launchBrowser, FORMATS, ROOT } from './page.mjs';

const args = parseArgs(process.argv.slice(2));
const videoDir = args._[0];
if (!videoDir || !existsSync(path.join(videoDir, 'index.html'))) {
  console.error('Uso: npm run critique -- videos/<nome> [--frames 8] [--format 16:9|9:16|1:1|all]');
  process.exit(1);
}
const nFrames = Number(args.frames || 8);
const fmtArg = String(args.format || '16:9');
const formats = fmtArg === 'all' ? Object.keys(FORMATS) : fmtArg.split(',');
const framesDir = path.join(videoDir, 'frames');
mkdirSync(framesDir, { recursive: true });

function pickTimes(meta) {
  if (args.at) return String(args.at).split(',').map(Number).map((t) => ({ t, label: '' }));
  const D = meta.duration, out = [];
  if (meta.scenes && meta.scenes.length) {
    meta.scenes.forEach((s, i) => {
      const end = s.end ?? meta.scenes[i + 1]?.start ?? D;
      out.push({ t: +(s.start + (end - s.start) * 0.62).toFixed(3), label: s.name || `cena ${i + 1}` });
    });
    // completa até N com instantes de transição (onde problemas costumam se esconder)
    for (let i = 1; out.length < nFrames && i < meta.scenes.length; i++) out.push({ t: +(meta.scenes[i].start + 0.08).toFixed(3), label: `corte → ${meta.scenes[i].name || i + 1}` });
    return out.sort((a, b) => a.t - b.t);
  }
  for (let i = 0; i < nFrames; i++) out.push({ t: +(((i + 0.5) / nFrames) * D).toFixed(3), label: '' });
  return out;
}

const { server, port } = await startServer();
const browser = await launchBrowser();
const sections = [];
try {
  for (const format of formats) {
    const { page, context, meta } = await openVideoPage(browser, { port, videoDir, format, scale: 1 });
    const times = pickTimes(meta);
    const shots = [];
    for (const [i, { t, label }] of times.entries()) {
      await seekTo(page, t);
      const file = path.join(framesDir, `${FORMATS[format].slug}_${String(i).padStart(2, '0')}_${t.toFixed(2)}s.png`);
      await page.screenshot({ path: file, type: 'png' });
      shots.push({ file, t, label });
      console.log(`  ${file}`);
    }
    await context.close();
    sections.push({ format, shots, duration: meta.duration });
  }

  // Monta a folha de contato no próprio navegador (sem dependências de imagem).
  const name = path.basename(path.resolve(videoDir));
  const rel = (f) => '/' + path.relative(ROOT, path.resolve(f)).split(path.sep).join('/');
  const fmtT = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;
  const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/node_modules/@fontsource/inter/400.css"><link rel="stylesheet" href="/node_modules/@fontsource/inter/700.css">
<link rel="stylesheet" href="/node_modules/@fontsource/jetbrains-mono/500.css">
<style>
 body{margin:0;background:#0d0d0f;color:#e8e8ea;font-family:Inter,sans-serif;padding:40px;width:max-content}
 h1{font-size:28px;margin:0 0 6px} .sub{color:#8a8a92;font:500 15px 'JetBrains Mono';margin-bottom:28px}
 h2{font:500 16px 'JetBrains Mono';color:#9a9aa4;margin:26px 0 12px;letter-spacing:.06em}
 .grid{display:grid;gap:18px} .cell{background:#16161a;border-radius:10px;overflow:hidden;border:1px solid #26262c}
 .cell img{display:block} .cap{display:flex;justify-content:space-between;gap:12px;padding:10px 12px;font:500 15px 'JetBrains Mono'}
 .cap b{color:#fff} .cap span{color:#8a8a92;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
</style></head><body>
<h1>${name}</h1><div class="sub">contact sheet · ${sections.map((s) => s.format).join(' / ')} · ${sections[0].duration}s</div>
${sections.map((s) => {
    const f = FORMATS[s.format];
    const tw = f.w >= f.h ? 480 : 270, th = Math.round(tw * f.h / f.w);
    const cols = f.w >= f.h ? 4 : 6;
    return `<h2>${s.format}</h2><div class="grid" style="grid-template-columns:repeat(${Math.min(cols, s.shots.length)},${tw}px)">
${s.shots.map((sh, i) => `<div class="cell"><img src="${rel(sh.file)}" width="${tw}" height="${th}"><div class="cap"><b>${i + 1} · ${fmtT(sh.t)}</b><span>${sh.label}</span></div></div>`).join('')}</div>`;
  }).join('')}
</body></html>`;
  const tmp = path.join(framesDir, '_sheet.html');
  writeFileSync(tmp, html);
  const ctx = await browser.newContext({ viewport: { width: 800, height: 600 } });
  const pg = await ctx.newPage();
  await pg.goto(`http://127.0.0.1:${port}${rel(tmp)}`, { waitUntil: 'load' });
  await pg.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); });
  const out = path.join(videoDir, 'contact_sheet.png');
  await pg.screenshot({ path: out, fullPage: true });
  await ctx.close();
  console.log(`✓ ${out}`);
  console.log('Agora OLHE a folha e os frames, dê notas 0–10 e liste os 3 piores problemas (ver CLAUDE.md).');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
