// Detect anti-bot / block pages so we report an honest 'blocked' status instead
// of silently returning nothing (or fake data).
import type { Page } from 'playwright';

export async function detectBlock(page: Page): Promise<string | null> {
  let title = '', body = '';
  try { title = await page.title(); } catch {}
  try { body = await page.evaluate(() => document.body?.innerText?.slice(0, 4000) || ''); } catch {}
  const hay = `${title} ${body} ${page.url()}`.toLowerCase();
  if (/captcha|recaptcha|hcaptcha|are you a robot|verify (you|your)|prove you.?re (a )?human|unusual traffic|automated queries|access denied|access to this page has been denied|datadome|perimeterx|px-captcha|enable javascript and cookies to continue|pardon our interruption/.test(hay)) return 'anti-bot / captcha';
  if (/rate.?limit|too many requests|429/.test(hay)) return 'rate-limited';
  if (/before you continue to google|consent\.google/.test(hay)) return 'google consent wall';
  return null;
}
