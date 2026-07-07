// One Chromium, stealthed, realistic consistent UA. Persistent context in a
// throwaway profile dir (RUNNER_TEMP in Actions). Headed when HEADLESS=false so
// the owner can watch it work locally.
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BrowserContext } from 'playwright';

chromium.use(stealth());

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

export async function launchBrowser(): Promise<BrowserContext> {
  const headless = process.env.HEADLESS !== 'false';
  const profileDir = mkdtempSync(join(process.env.RUNNER_TEMP || tmpdir(), 'leadgen-'));
  const ctx = await chromium.launchPersistentContext(profileDir, {
    headless,
    args: ['--disable-blink-features=AutomationControlled', '--no-first-run', '--no-default-browser-check'],
    userAgent: UA,
    viewport: { width: 1366, height: 900 },
    locale: 'en-US',
  });
  ctx.setDefaultNavigationTimeout(20000);
  ctx.setDefaultTimeout(15000);
  return ctx;
}
