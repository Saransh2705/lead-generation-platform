// Google Maps adapter — PUBLIC search (NO login, to protect the ops account).
// Extracts business names via aria-labels from the results feed. Google blocks
// datacenter IPs hardest (consent walls / captchas), so this is best-effort and
// most cloud runs will report 'blocked'. Phone/website need per-place clicks
// (skipped to stay fast), so yield is name-only unless enriched via a website.
import type { BrowserContext } from 'playwright';
import type { RawCandidate } from '../quality/types';
import type { SourceOpts, SourceResult } from './yellowPages';
import { detectBlock } from '../core/blockDetect';

export async function googleMapsSearch(ctx: BrowserContext, o: SourceOpts): Promise<SourceResult> {
  const term = (o.searchTerms || 'business').trim();
  const at = o.lat != null && o.lng != null ? `/@${o.lat},${o.lng},13z` : '';
  const url = `https://www.google.com/maps/search/${encodeURIComponent(term + ' ' + (o.geo || ''))}${at}?hl=en`;
  const page = await ctx.newPage();
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded' });
    // Google often shows a consent wall or captcha to datacenter IPs.
    const blocked = await detectBlock(page);
    if (blocked || (resp && resp.status() >= 400)) return { candidates: [], status: 'blocked', error: blocked || `http ${resp?.status()}` };
    await page.waitForTimeout(2500);

    const raw = await page.$$eval('a[href*="/maps/place/"]', (as) =>
      [...new Set(as.map((a) => (a as HTMLElement).getAttribute('aria-label') || '').filter(Boolean))]
    ).catch(() => [] as string[]);

    if (!raw.length) {
      const blocked2 = await detectBlock(page);
      return { candidates: [], status: blocked2 ? 'blocked' : 'empty', error: blocked2 || undefined };
    }
    const seen = new Set<string>();
    const candidates: RawCandidate[] = [];
    for (const name of raw) {
      const nm = name.trim();
      if (!nm || seen.has(nm.toLowerCase())) continue;
      seen.add(nm.toLowerCase());
      candidates.push({
        category: o.category, name: nm, phone: null, website: null,
        location: o.geo, country: o.country ?? null, state: o.state ?? null, city: o.city ?? null,
        geo: o.geo, lat: o.lat ?? null, lng: o.lng ?? null, source_key: 'google_maps',
        source_url: url, socials: {}, raw: { name: nm },
      });
      if (candidates.length >= o.limit) break;
    }
    return { candidates, status: candidates.length ? 'ok' : 'empty' };
  } catch (e: any) {
    return { candidates: [], status: 'error', error: e?.message || 'google maps failed' };
  } finally {
    await page.close().catch(() => {});
  }
}
