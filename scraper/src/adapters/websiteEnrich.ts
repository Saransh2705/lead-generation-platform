// Website enrichment: open a business's site in the (headed) browser and pull an
// email + phone from the homepage and contact-ish pages. Prefers mailto:/tel:
// links and emails on the business's own domain. This is the visible scraping step.
// Zero-cost yield boosters: more contact paths (incl. EU /imprint which is legally
// required to list contacts), de-obfuscated "name [at] site [dot] com" emails, and
// decoded Cloudflare data-cfemail addresses.
import type { BrowserContext } from 'playwright';
import { websiteDomain } from '../quality/normalize';
import { isPlaceholderEmail } from '../quality/disposable';
import { collectSocials } from '../core/socials';
import { pace } from '../core/pacing';

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
// Homepage first, then the pages most likely to carry contacts. /impressum &
// /imprint are legally mandated contact pages on EU/DE sites (near-guaranteed email).
const CONTACT_PATHS = ['', 'contact', 'contact-us', 'contactus', 'about', 'about-us',
  'team', 'staff', 'support', 'kontakt', 'impressum', 'imprint', 'legal-notice'];
// Business inboxes we'd rather surface than a random personal address.
const ROLE_PREFIXES = ['info', 'contact', 'hello', 'sales', 'office', 'enquiries', 'inquiries', 'admin', 'mail', 'support'];

// "name [at] domain (dot) com" / "name AT domain DOT com" → name@domain.com
function deobfuscate(text: string): string[] {
  const norm = text
    .replace(/\s*[\[(]?\s*(?:@|at|\(at\)|\[at\])\s*[\])]?\s*/gi, '@')
    .replace(/\s*[\[(]?\s*(?:dot|\(dot\)|\[dot\])\s*[\])]?\s*/gi, '.');
  return norm.match(EMAIL_RE) || [];
}

// Cloudflare email-protection: <a data-cfemail="hexhex…"> — first byte is XOR key.
function decodeCfEmail(hex: string): string | null {
  try {
    const key = parseInt(hex.slice(0, 2), 16);
    let out = '';
    for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
    return EMAIL_RE.test(out) ? out.toLowerCase() : null;
  } catch { return null; }
}

function pickEmail(emails: string[], domain: string | null): string | null {
  const clean = [...new Set(emails.map((e) => e.toLowerCase().replace(/[.,;:]+$/, '')))].filter((e) => !isPlaceholderEmail(e));
  if (!clean.length) return null;
  if (domain) {
    const own = clean.filter((e) => e.endsWith('@' + domain));
    if (own.length) {
      const role = own.find((e) => ROLE_PREFIXES.includes(e.split('@')[0]));
      return role || own[0];
    }
  }
  const roleAny = clean.find((e) => ROLE_PREFIXES.includes(e.split('@')[0]));
  return roleAny || clean[0];
}

// Pull a company logo + heavy description from a page's metadata (JSON-LD →
// OpenGraph → meta), resolving relative URLs. Only what the site actually exposes.
async function extractMeta(page: import('playwright').Page): Promise<{ logo: string | null; desc: string | null }> {
  // NOTE: no named helper functions inside evaluate() — esbuild/tsx would inject a
  // __name() call that doesn't exist in the browser and throw. Keep it all inline.
  return page.evaluate(() => {
    let logo: string | null = null, desc: string | null = null;
    for (const s of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
      try {
        const data = JSON.parse(s.textContent || '');
        const arr = Array.isArray(data) ? data : (data['@graph'] || [data]);
        for (const o of arr) {
          if (!o || typeof o !== 'object') continue;
          if (!logo && o.logo) logo = typeof o.logo === 'string' ? o.logo : (o.logo && o.logo.url);
          if ((!desc || desc.length < 80) && typeof o.description === 'string') desc = o.description;
        }
      } catch (e) { /* bad ld+json */ }
    }
    if (!logo) { const img = document.querySelector('img[class*="logo" i],img[alt*="logo" i],img[id*="logo" i],header img'); if (img) logo = img.getAttribute('src'); }
    if (!logo) { const el = document.querySelector('link[rel~="apple-touch-icon"]') || document.querySelector('meta[property="og:image"]') || document.querySelector('link[rel~="icon"]'); if (el) logo = el.getAttribute('href') || el.getAttribute('content'); }
    if (!desc) { const el = document.querySelector('meta[property="og:description"]') || document.querySelector('meta[name="description"]'); if (el) desc = el.getAttribute('content'); }
    let absLogo: string | null = null;
    if (logo) { try { absLogo = new URL(logo, location.href).href; } catch (e) { absLogo = null; } }
    return { logo: absLogo, desc: desc ? desc.replace(/\s+/g, ' ').trim().slice(0, 800) : null };
  }).catch(() => ({ logo: null, desc: null }));
}

export async function enrichFromWebsite(
  ctx: BrowserContext,
  website: string
): Promise<{ email: string | null; phone: string | null; socials: Record<string, string>; logo: string | null; description: string | null }> {
  const domain = websiteDomain(website);
  let base = website.trim();
  if (!/^https?:\/\//i.test(base)) base = 'https://' + base;
  let origin: string;
  try { origin = new URL(base).origin; } catch { return { email: null, phone: null, socials: {} }; }

  const page = await ctx.newPage();
  let email: string | null = null;
  let phone: string | null = null;
  let logo: string | null = null;
  let description: string | null = null;
  const emailPool: string[] = [];
  const socials: Record<string, string> = {};
  try {
    for (const path of CONTACT_PATHS) {
      // Stop once we have a solid own-domain email + phone (still cheap to have run homepage for socials).
      if (email && email.endsWith('@' + (domain || '\0')) && phone) break;
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

      // Cloudflare-protected emails hidden in data-cfemail attributes.
      const cfHexes = await page.$$eval('[data-cfemail]', (els) =>
        els.map((e) => e.getAttribute('data-cfemail') || '').filter(Boolean)
      ).catch(() => [] as string[]);
      const cfEmails = cfHexes.map(decodeCfEmail).filter((e): e is string => !!e);

      // emails in page text (plain + de-obfuscated) as a fallback
      const bodyText = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
      const regexEmails = bodyText.match(EMAIL_RE) || [];
      const obfEmails = deobfuscate(bodyText);

      emailPool.push(...mailtos, ...cfEmails, ...regexEmails, ...obfEmails);
      email = pickEmail(emailPool, domain);
      if (!phone && tels.length) phone = tels[0];

      // Logo (first found) + description (keep the longest/heaviest across pages).
      const meta = await extractMeta(page);
      if (!logo && meta.logo) logo = meta.logo;
      if (meta.desc && meta.desc.length > (description?.length || 0)) description = meta.desc;

      // Keep visiting the remaining paths to gather more socials / a better email.
      await pace(500, 1200);
    }
  } finally {
    await page.close().catch(() => {});
  }
  return { email, phone, socials, logo, description };
}
