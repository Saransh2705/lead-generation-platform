// One work-item = scrape one source for one (category, geo). Shared by the local
// harness and the GitHub Actions worker. Discovery → enrich → quality payloads.
import type { BrowserContext } from 'playwright';
import { geocode } from './core/geocode';
import { overpassSearch } from './adapters/overpass';
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

  // Only OpenStreetMap discovery is implemented so far (website_enrich is a step,
  // google_maps/yellowpages come in Phase 6).
  if (item.source_key !== 'osm_overpass') return { ...base, status: 'error', error: 'source not implemented' };

  // Prefer the category's pre-geocoded coords (Nominatim blocks datacenter IPs).
  let lat = item.lat ?? null, lng = item.lng ?? null;
  if ((lat == null || lng == null) && geo) {
    const loc = await geocode(geo);
    if (loc) { lat = loc.lat; lng = loc.lng; }
  }
  if (lat == null || lng == null) return { ...base, status: 'error', error: 'no coordinates (category not geocoded)' };

  const seed = await overpassSearch({
    category: item.category, lat, lng, geo, limit,
    radiusM: item.radius_m ?? undefined, searchTerms: item.search_terms, osmFilter: item.osm_filter, country: item.country,
  });
  if (seed.status !== 'ok') return { ...base, status: seed.status, found: seed.candidates.length, error: seed.error };

  let enriched = 0;
  for (const c of seed.candidates) {
    if (c.website && !c.email) {
      try {
        const e = await enrichFromWebsite(ctx, c.website);
        if (e.email) { c.email = e.email; enriched++; }
        if (!c.phone && e.phone) c.phone = e.phone;
        c.socials = { ...e.socials, ...(c.socials || {}) };
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
