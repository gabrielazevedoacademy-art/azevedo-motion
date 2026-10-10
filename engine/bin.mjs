// Caminhos centralizados de ffmpeg, ffprobe e Chromium.
// Ordem do Chromium: $CHROMIUM_PATH → Chromium do Playwright → /opt/pw-browsers →
// chromium/chromium-browser/google-chrome no PATH → @sparticuz/chromium (se instalado).
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export const FFMPEG = process.env.FFMPEG_PATH || require('ffmpeg-static');
export const FFPROBE = process.env.FFPROBE_PATH || require('ffprobe-static').path;

function which(cmd) {
  try {
    const p = execSync(`command -v ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return p && existsSync(p) ? p : null;
  } catch { return null; }
}

let cached;
/** Retorna { executablePath, args } para chromium.launch(). executablePath undefined = padrão do Playwright. */
export async function resolveChromium() {
  if (cached) return cached;
  const args = ['--disable-gpu-sandbox', '--no-sandbox', '--font-render-hinting=none', '--force-color-profile=srgb', '--hide-scrollbars'];
  const candidates = [];
  if (process.env.CHROMIUM_PATH) candidates.push(['env', process.env.CHROMIUM_PATH]);
  try {
    const { chromium } = await import('playwright');
    candidates.push(['playwright', chromium.executablePath()]);
  } catch {}
  candidates.push(['opt', '/opt/pw-browsers/chromium']);
  for (const c of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable']) {
    const p = which(c); if (p) candidates.push(['system', p]);
  }
  for (const [src, p] of candidates) {
    if (p && existsSync(p)) {
      cached = { executablePath: src === 'playwright' ? undefined : p, args, source: src, path: p };
      return cached;
    }
  }
  try {
    const mod = await import('@sparticuz/chromium');
    const sc = mod.default;
    cached = { executablePath: await sc.executablePath(), args: [...sc.args, ...args], source: 'sparticuz' };
    return cached;
  } catch {}
  throw new Error('Nenhum Chromium encontrado. Rode: bash scripts/setup.sh (ou defina CHROMIUM_PATH).');
}

export async function launchBrowser() {
  const { chromium } = await import('playwright');
  const c = await resolveChromium();
  return chromium.launch({ executablePath: c.executablePath, args: c.args, headless: true });
}

export const FORMATS = {
  '16:9': { w: 1920, h: 1080, slug: '16x9' },
  '9:16': { w: 1080, h: 1920, slug: '9x16' },
  '1:1': { w: 1080, h: 1080, slug: '1x1' },
};

// CLI: node engine/bin.mjs → imprime o que foi encontrado
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('ffmpeg :', FFMPEG, existsSync(FFMPEG) ? 'OK' : 'FALTANDO');
  console.log('ffprobe:', FFPROBE, existsSync(FFPROBE) ? 'OK' : 'FALTANDO');
  resolveChromium().then(c => console.log('chromium:', c.source, c.path || c.executablePath || '(padrão playwright)'))
    .catch(e => { console.log('chromium: FALTANDO —', e.message); process.exit(1); });
}
