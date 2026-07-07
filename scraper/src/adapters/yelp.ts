// Yelp search-results adapter. Best-effort: Yelp is heavily anti-bot and its
// search cards rarely expose website/phone, so yield from the cloud is low and
// blocks are common — we report both honestly.
import type { BrowserContext } from 'playwright';
import type { RawCandidate } from '../quality/types';
import type { SourceOpts, SourceResult } from './yellowPages';
import { detectBlock } from '../core/blockDetect';

export async function yelpSearch(ctx: BrowserContext, o: SourceOpts): Promise<SourceResult> {
  const term = (o.searchTerms || 'business').trim();
  const url = `https://www.yelp.com/search?find_desc=${encodeURIComponent(term)}&find_loc=${encodeURIComponent(o.geo || '')}`;
  const page = await ctx.newPage();
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded' });
    const blocked = await detectBlock(page);
    if (blocked || (resp && resp.status() >= 400)) return { candidates: [], status: 'blocked', error: blocked || `http ${resp?.status()}` };

    const raw = await page.$$eval('div[data-testid="serp-ia-card"], li div[class*="container"]', (cards) =>
      cards.map((c) => {
        const nameA = c.querySelector('a[href*="/biz/"]') as HTMLAnchorElement | null;
        const name = nameA?.textContent?.trim() || null;
        const m = (c.textContent || '').match(/(\+?\d[\d\s().-]{8,}\d)/);
        return { name, phone: m ? m[1].trim() : null, href: nameA?.href || null };
      }).filter((x) => x.name)
    ).catch(() => [] as any[]);

    if (!raw.length) return { candidates: [], status: 'empty' };
    const seen = new Set<string>();
    const candidates: RawCandidate[] = [];
    for (const r of raw) {
      if (seen.has(r.name.toLowerCase())) continue;
      seen.add(r.name.toLowerCase());
      candidates.push({
        category: o.category, name: r.name, phone: r.phone, website: null,
        location: o.geo, country: o.country ?? null, state: o.state ?? null, city: o.city ?? null,
        geo: o.geo, lat: o.lat ?? null, lng: o.lng ?? null, source_key: 'yelp',
        source_url: r.href || url, socials: {}, raw: r,
      });
      if (candidates.length >= o.limit) break;
    }
    return { candidates, status: candidates.length ? 'ok' : 'empty' };
  } catch (e: any) {
    return { candidates: [], status: 'error', error: e?.message || 'yelp failed' };
  } finally {
    await page.close().catch(() => {});
  }
}
