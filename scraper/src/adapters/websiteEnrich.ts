// Website enrichment: open a business's site in the (headed) browser and pull an
// email + phone from the homepage and a /contact-ish page. Prefers mailto:/tel:
// links and emails on the business's own domain. This is the visible scraping step.
import type { BrowserContext } from 'playwright';
import { websiteDomain } from '../quality/normalize';
import { isPlaceholderEmail } from '../quality/disposable';
import { collectSocials } from '../core/socials';
import { pace } from '../core/pacing';

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const CONTACT_PATHS = ['', 'contact', 'contact-us', 'about', 'about-us'];

function pickEmail(emails: string[], domain: string | null): string | null {
  const clean = [...new Set(emails.map((e) => e.toLowerCase()))].filter((e) => !isPlaceholderEmail(e));
  if (!clean.length) return null;
  if (domain) {
    const own = clean.find((e) => e.endsWith('@' + domain));
    if (own) return own;
  }
  return clean[0];
}

export async function enrichFromWebsite(
  ctx: BrowserContext,
  website: string
): Promise<{ email: string | null; phone: string | null; socials: Record<string, string> }> {
  const domain = websiteDomain(website);
  let base = website.trim();
  if (!/^https?:\/\//i.test(base)) base = 'https://' + base;
  let origin: string;
  try { origin = new URL(base).origin; } catch { return { email: null, phone: null, socials: {} }; }

  const page = await ctx.newPage();
  let email: string | null = null;
  let phone: string | null = null;
  const socials: Record<string, string> = {};
  try {
    for (const path of CONTACT_PATHS) {
      const url = path ? `${origin}/${path}` : origin;
      try {
        const resp = await page.goto(url, { waitUntil: 'domcontentloaded' });
        if (!resp || !resp.ok()) continue;
      } catch { continue; }

      // Grab every anchor href once, then bucket by type.
      const hrefs = await page.$$eval('a[href]', (as) =>
        as.map((a) => (a as HTMLAnchorElement).href).filter(Boolean)
      ).catch(() => [] as string[]);

      const mailtos = hrefs.filter((h) => h.startsWith('mailto:')).map((h) => decodeURIComponent(h.slice(7).split('?')[0]).trim());
      const tels = hrefs.filter((h) => h.startsWith('tel:')).map((h) => decodeURIComponent(h.slice(4)).trim());

      // socials / github / linkedin etc. (accumulate across pages, first-seen wins)
      collectSocials(hrefs.filter((h) => /^https?:/i.test(h)), socials);

      // emails in page text as a fallback
      const bodyText = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
      const regexEmails = bodyText.match(EMAIL_RE) || [];

      if (!email) email = pickEmail([...mailtos, ...regexEmails], domain);
      if (!phone && tels.length) phone = tels[0];

      // Keep visiting /contact,/about to gather more socials even once email+phone found.
      await pace(600, 1400);
    }
  } finally {
    await page.close().catch(() => {});
  }
  return { email, phone, socials };
}
