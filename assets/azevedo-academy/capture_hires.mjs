// Recortes em 3x para o vídeo: botão Inscrever-se, linhas de "Mais informações" e IDs dos vídeos "Em alta".
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { resolveChromium } from '../../engine/bin.mjs';
const DIR = new URL('./', import.meta.url).pathname, OUT = DIR + 'screens/';
const c = await resolveChromium();
const browser = await chromium.launch({ executablePath: c.executablePath, args: c.args, headless: true, proxy: { server: process.env.HTTPS_PROXY } });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 3, locale: 'pt-BR' });
await ctx.addCookies([{ name: 'PREF', value: 'f6=400&hl=pt&gl=BR', domain: '.youtube.com', path: '/' }]);
const page = await ctx.newPage();
await page.goto('https://www.youtube.com/@Azevedo.Academy', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await page.locator('yt-subscribe-button-view-model button, yt-flexible-actions-view-model button').first().screenshot({ path: OUT + 'subscribe_dark@3x.png' });
await page.locator('yt-page-header-view-model .yt-page-header-view-model__page-header-headline-info, yt-page-header-view-model').first().screenshot({ path: OUT + 'header_info_dark@3x.png' }).catch((e) => console.log('header', e.message));
await page.getByText('Bem-vindo ao Azevedo', { exact: false }).first().click({ timeout: 10000 });
await page.waitForTimeout(3000);
await page.mouse.move(1000, 600);
for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 400); await page.waitForTimeout(250); }
await page.waitForTimeout(800);
const rows = page.locator('#additional-info-container tr, #additional-info-container table');
console.log('linhas sobre:', await rows.count());
if (await rows.count()) await page.locator('#additional-info-container').first().screenshot({ path: OUT + 'about_info_dark@3x.png' });
await page.goto('https://www.youtube.com/@Azevedo.Academy/videos', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await page.getByText('Em alta', { exact: true }).first().click();
await page.waitForTimeout(5000);
const top = await page.$$eval('ytd-rich-item-renderer', (els) => els.slice(0, 6).map((e) => ({
  href: e.querySelector('a[href*="watch"]')?.getAttribute('href'), text: e.innerText.split('\n').filter(Boolean) })));
writeFileSync(DIR + 'popular.json', JSON.stringify(top, null, 2));
console.log(top);
await browser.close();
