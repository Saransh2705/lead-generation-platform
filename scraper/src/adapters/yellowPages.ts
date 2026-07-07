// Yellow Pages search-results adapter. Listings carry name + phone + website
// directly, so it's the most extractable directory — but it's DataDome-protected,
// so it often blocks datacenter IPs. We detect that and report 'blocked' honestly.
import type { BrowserContext } from 'playwright';
import type { RawCandidate } from '../quality/types';
import { detectBlock } from '../core/blockDetect';

export type SourceOpts = {
  category: string; searchTerms?: string | null; geo?: string | null;
  country?: string | null; state?: string | null; city?: string | null; limit: number;
  lat?: number | null; lng?: number | null;
};
export type SourceResult = { candidates: RawCandidate[]; status: 'ok' | 'empty' | 'blocked' | 'error'; error?: string };

export async function yellowPagesSearch(ctx: BrowserContext, o: SourceOpts): Promise<SourceResult> {
  const term = (o.searchTerms || 'business').trim();
  const loc = (o.geo || '').trim();
  const url = `https://www.yellowpages.com/search?search_terms=${encodeURIComponent(term)}&geo_location_terms=${encodeURIComponent(loc)}`;
  const page = await ctx.newPage();
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded' });
    const blocked = await detectBlock(page);
    if (blocked || (resp && resp.status() >= 400)) return { candidates: [], status: 'blocked', error: blocked || `http ${resp?.status()}` };

    const raw = await page.$$eval('.search-results .result, .organic .result, div.result', (cards) =>
      cards.map((c) => {
        const q = (sel: string) => (c.querySelector(sel) as HTMLElement | null);
        const name = q('.business-name span, .business-name')?.textContent?.trim() || null;
        const phone = q('.phones.phone.primary, .phone, [class*="phone"]')?.textContent?.trim() || null;
        const a = c.querySelector('a.track-visit-website, a[class*="website"]') as HTMLAnchorElement | null;
        const website = a?.href || null;
        const street = q('.street-address')?.textContent?.trim() || null;
        return { name, phone, website, street };
      }).filter((x) => x.name && (x.phone || x.website))
    ).catch(() => [] as any[]);

    if (!raw.length) return { candidates: [], status: 'empty' };
    const seen = new Set<string>();
    const candidates: RawCandidate[] = [];
    for (const r of raw) {
      const key = (r.name + '|' + (r.website || r.phone || '')).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({
        category: o.category, name: r.name, phone: r.phone, website: r.website,
        location: r.street ? `${r.street}, ${o.geo}` : o.geo, country: o.country ?? null, state: o.state ?? null, city: o.city ?? null,
        geo: o.geo, lat: o.lat ?? null, lng: o.lng ?? null, source_key: 'yellowpages',
        source_url: r.website || url, socials: {}, raw: r,
      });
      if (candidates.length >= o.limit) break;
    }
    return { candidates, status: candidates.length ? 'ok' : 'empty' };
  } catch (e: any) {
    return { candidates: [], status: 'error', error: e?.message || 'yellowpages failed' };
  } finally {
    await page.close().catch(() => {});
  }
}
