// One work-item = scrape one source for one (category, geo). Shared by the local
// harness and the GitHub Actions worker. Discovery → enrich → quality payloads.
import type { BrowserContext } from 'playwright';
import { geocode } from './core/geocode';
import { overpassSearch } from './adapters/overpass';
import { yellowPagesSearch, type SourceResult } from './adapters/yellowPages';
import { yelpSearch } from './adapters/yelp';
import { googleMapsSearch } from './adapters/googleMaps';
import { searchDiscovery } from './adapters/searchDiscovery';
import { enrichFromWebsite } from './adapters/websiteEnrich';
import { toUpsertPayload } from './quality/dedupe';
import { pace } from './core/pacing';
import type { UpsertPayload } from './quality/types';

export type WorkItem = {
  category: string;
  source_key: string;
  geo?: string | null;
  lat?: number | null;
  lng?: number | null;
  search_terms?: string | null;
  osm_filter?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  radius_m?: number | null;
  count?: number;
};
export type ItemResult = { source_key: string; status: 'ok' | 'empty' | 'blocked' | 'error'; found: number; enriched: number; payloads: UpsertPayload[]; error?: string };

export async function scrapeItem(
  ctx: BrowserContext,
  item: WorkItem,
  scrape_env: 'cloud' | 'home' | 'manual',
  jobId?: number | null
): Promise<ItemResult> {
  const geo = item.geo || '';
  const limit = Math.max(1, Math.min(50, item.count || 12));
  const base = { source_key: item.source_key, found: 0, enriched: 0, payloads: [] as UpsertPayload[] };

  // Dispatch to the source's adapter. Each is independent; the worker isolates
  // per item, so one blocked source never stops the others.
  const src = item.source_key;
  const sopts = {
    category: item.category, searchTerms: item.search_terms, geo,
    country: item.country, state: item.state, city: item.city, limit,
    lat: item.lat ?? null, lng: item.lng ?? null,
  };
  let seed: SourceResult;
  if (src === 'osm_overpass') {
    let lat = item.lat ?? null, lng = item.lng ?? null;
    if ((lat == null || lng == null) && geo) { const loc = await geocode(geo); if (loc) { lat = loc.lat; lng = loc.lng; } }
    if (lat == null || lng == null) return { ...base, status: 'error', error: 'no coordinates (category not geocoded)' };
    seed = await overpassSearch({
      category: item.category, lat, lng, geo, limit,
      radiusM: item.radius_m ?? undefined, searchTerms: item.search_terms, osmFilter: item.osm_filter,
      country: item.country, state: item.state, city: item.city,
    });
  } else if (src === 'yellowpages') {
    seed = await yellowPagesSearch(ctx, sopts);
  } else if (src === 'yelp') {
    seed = await yelpSearch(ctx, sopts);
  } else if (src === 'google_maps') {
    seed = await googleMapsSearch(ctx, sopts);
  } else if (src === 'web_search') {
    seed = await searchDiscovery(sopts); // plain fetch, no browser needed for the search
  } else {
    return { ...base, status: 'error', error: 'source not implemented' };
  }
  if (seed.status !== 'ok') return { ...base, status: seed.status, found: seed.candidates.length, error: seed.error };

  let enriched = 0;
  for (const c of seed.candidates) {
    // Visit the site if it can still add value (email, logo, or a heavy description).
    if (c.website && (!c.email || !c.logo_url || !c.description)) {
      try {
        const e = await enrichFromWebsite(ctx, c.website);
        if (e.email) { c.email = e.email; enriched++; }
        if (!c.phone && e.phone) c.phone = e.phone;
        c.socials = { ...e.socials, ...(c.socials || {}) };
        if (e.logo && !c.logo_url) c.logo_url = e.logo;
        if (e.description && !c.description) c.description = e.description;
      } catch { /* one bad site never fails the batch */ }
      await pace(1500, 4000);
    }
  }

  const payloads: UpsertPayload[] = [];
  for (const c of seed.candidates) {
    const p = await toUpsertPayload(c, { scrape_env, scrape_job_id: jobId ?? null });
    if (p) payloads.push(p);
  }
  return { source_key: item.source_key, status: 'ok', found: seed.candidates.length, enriched, payloads };
}
