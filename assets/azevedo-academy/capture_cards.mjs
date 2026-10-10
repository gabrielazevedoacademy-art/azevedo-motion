// Aba Vídeos → "Em alta": captura os 3 primeiros cards reais (card, miniatura, bloco de título).
import { chromium } from 'playwright';
import { resolveChromium } from '../../engine/bin.mjs';
const OUT = new URL('./screens/', import.meta.url).pathname;
const c = await resolveChromium();
const browser = await chromium.launch({ executablePath: c.executablePath, args: c.args, headless: true, proxy: { server: process.env.HTTPS_PROXY } });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2, locale: 'pt-BR' });
await ctx.addCookies([{ name: 'PREF', value: 'f6=400&hl=pt&gl=BR', domain: '.youtube.com', path: '/' }]);
const page = await ctx.newPage();
await page.goto('https://www.youtube.com/@Azevedo.Academy/videos', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await page.getByText('Em alta', { exact: true }).first().click();
await page.waitForTimeout(5000);
await page.screenshot({ path: OUT + 'videos_popular_dark.png' });
const items = page.locator('ytd-rich-item-renderer');
const info = [];
for (let i = 0; i < 3; i++) {
  const it = items.nth(i);
  await it.scrollIntoViewIfNeeded();
  await page.mouse.move(5, 5);
  await page.waitForTimeout(1200);
  await it.screenshot({ path: `${OUT}card${i + 1}.png` });
  const thumb = it.locator('a#thumbnail, yt-thumbnail-view-model, .yt-lockup-view-model__content-image').first();
  if (await thumb.count()) await thumb.screenshot({ path: `${OUT}card${i + 1}_thumb.png` });
  const meta = it.locator('#details, .yt-lockup-view-model__metadata, yt-lockup-metadata-view-model').first();
  if (await meta.count()) await meta.screenshot({ path: `${OUT}card${i + 1}_meta.png` });
  info.push(await it.innerText());
}
console.log(JSON.stringify(info, null, 1));
await browser.close();
