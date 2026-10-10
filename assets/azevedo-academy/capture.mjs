// Captura telas reais do canal (Playwright). Uso: node assets/azevedo-academy/capture.mjs
import { launchBrowser } from '../../engine/bin.mjs';
import { chromium } from 'playwright';
import { resolveChromium } from '../../engine/bin.mjs';
const OUT = new URL('./screens/', import.meta.url).pathname;
const c = await resolveChromium();
const browser = await chromium.launch({ executablePath: c.executablePath, args: c.args, headless: true,
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1.5, locale: 'pt-BR', colorScheme: 'dark' });
// tema escuro do YouTube (cookie PREF f6=400); a versão clara fica em screens/*_light.png
const DARK = process.argv.includes('--dark');
if (DARK) await ctx.addCookies([{ name: 'PREF', value: 'f6=400&hl=pt&gl=BR', domain: '.youtube.com', path: '/' }]);
const SUF = DARK ? '_dark' : '_light';
const page = await ctx.newPage();
async function consent() {
  // tela de cookies: recusar o opcional
  for (const sel of ['button:has-text("Rejeitar tudo")', 'button:has-text("Reject all")', 'button[aria-label*="Rejeitar"]']) {
    const b = page.locator(sel).first();
    if (await b.count()) { await b.click().catch(() => {}); await page.waitForTimeout(1500); console.log('consent: rejeitado'); return; }
  }
}
for (const [name, path] of [['home', ''], ['videos', '/videos'], ['about', '/about']]) {
  await page.goto('https://www.youtube.com/@Azevedo.Academy' + path, { waitUntil: 'domcontentloaded' });
  await consent();
  await page.waitForTimeout(name === 'about' ? 7000 : 4000);
  await page.evaluate(() => document.querySelectorAll('ytd-mealbar-promo-renderer, tp-yt-paper-dialog').forEach((e) => e.remove()));
  await page.screenshot({ path: `${OUT}${name}${SUF}.png` });
  console.log('✓', name);
  if (name === 'home') {
    for (const [n, sel] of [['header', '#page-header, yt-page-header-renderer'], ['subscribe', 'yt-subscribe-button-view-model, #subscribe-button, yt-flexible-actions-view-model button']]) {
      const el = page.locator(sel).first();
      if (await el.count()) { await el.screenshot({ path: `${OUT}${n}${SUF}.png` }).catch((e) => console.log(n, e.message)); console.log('✓', n); }
    }
  }
  if (name === 'about') {
    const el = page.locator('ytd-about-channel-renderer, #about-container, tp-yt-paper-dialog').first();
    if (await el.count()) await el.screenshot({ path: `${OUT}about_panel${SUF}.png` }).catch(() => {});
  }
}
await browser.close();
