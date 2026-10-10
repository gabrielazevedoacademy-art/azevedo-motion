// Abre o painel "Sobre" (clique em "...mais") e captura. Uso: node assets/azevedo-academy/capture_about.mjs
import { chromium } from 'playwright';
import { resolveChromium } from '../../engine/bin.mjs';
const OUT = new URL('./screens/', import.meta.url).pathname;
const c = await resolveChromium();
const browser = await chromium.launch({ executablePath: c.executablePath, args: c.args, headless: true, proxy: { server: process.env.HTTPS_PROXY } });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1.5, locale: 'pt-BR' });
await ctx.addCookies([{ name: 'PREF', value: 'f6=400&hl=pt&gl=BR', domain: '.youtube.com', path: '/' }]);
const page = await ctx.newPage();
await page.goto('https://www.youtube.com/@Azevedo.Academy', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await page.getByText('Bem-vindo ao Azevedo', { exact: false }).first().click({ timeout: 10000 });
await page.waitForTimeout(4000);
await page.screenshot({ path: OUT + 'about_dark.png' });
// rola o painel até "Mais informações" (inscritos, vídeos, visualizações, data)
await page.mouse.move(1000, 600);
for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 400); await page.waitForTimeout(250); }
await page.waitForTimeout(800);
await page.screenshot({ path: OUT + 'about_stats_dark.png' });
const panel = page.locator('ytd-engagement-panel-section-list-renderer[visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"], tp-yt-paper-dialog, ytd-about-channel-renderer').first();
if (await panel.count()) await panel.screenshot({ path: OUT + 'about_panel_dark.png' }).then(() => console.log('✓ painel'));
await browser.close();
