// OpenStreetMap Overpass seed adapter. Coordinate-driven JSON API (no browser),
// datacenter-friendly. Yields businesses that have a name AND a website or phone.
// Emails are filled later by websiteEnrich.
import type { RawCandidate } from '../quality/types';

// Rotate across public Overpass mirrors; back off on 429/504.
// Multiple community mirrors — datacenter IPs (GitHub) get throttled, so we try
// several with a generous timeout and two passes.
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function overpassSearch(opts: {
  category: string;
  lat: number;
  lng: number;
  geo: string;
  limit: number;
  radiusM?: number;
}): Promise<{ candidates: RawCandidate[]; status: 'ok' | 'empty' | 'blocked' | 'error'; error?: string }> {
  const radius = opts.radiusM ?? 6000;
  const { lat, lng, limit } = opts;
  // Union of "has a name AND (website|phone)" — business-like POIs.
  const q = `[out:json][timeout:25];
(
  nwr(around:${radius},${lat},${lng})[name][website];
  nwr(around:${radius},${lat},${lng})[name]["contact:website"];
  nwr(around:${radius},${lat},${lng})[name][phone];
  nwr(around:${radius},${lat},${lng})[name]["contact:phone"];
);
out center ${Math.min(limit * 3, 200)};`;

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json',
    'User-Agent': `leadgen-scraper/1.0 (${process.env.LEADGEN_GMAIL_USER || 'contact@example.com'})`,
  };
  try {
    let els: any[] | null = null;
    let lastErr = 'overpass unavailable';
    // Two passes over the mirrors; Overpass under load can take 30-50s to respond.
    const order = [...ENDPOINTS, ...ENDPOINTS];
    for (let attempt = 0; attempt < order.length && els === null; attempt++) {
      const ac = new AbortController();
      const to = setTimeout(() => ac.abort(), 55000); // generous — public instances queue requests
      try {
        const res = await fetch(order[attempt], { method: 'POST', headers, body: 'data=' + encodeURIComponent(q), signal: ac.signal });
        if (res.status === 429 || res.status === 504) { lastErr = `overpass ${res.status}`; await sleep(3000); continue; }
        if (!res.ok) { lastErr = `overpass ${res.status}`; continue; }
        const data = (await res.json()) as { elements?: any[] };
        els = data.elements || [];
      } catch (e: any) {
        lastErr = e?.name === 'AbortError' ? 'overpass timeout' : (e?.message || 'overpass fetch error');
      } finally {
        clearTimeout(to);
      }
    }
    if (els === null) return { candidates: [], status: /429|504|timeout/.test(lastErr) ? 'blocked' : 'error', error: lastErr };
    const seen = new Set<string>();
    const candidates: RawCandidate[] = [];
    for (const el of els) {
      const t = el.tags || {};
      const name = t.name;
      if (!name) continue;
      const website = t.website || t['contact:website'] || null;
      const phone = t.phone || t['contact:phone'] || t['contact:mobile'] || null;
      const email = t.email || t['contact:email'] || null;
      // OSM stores socials under contact:* (or bare) tags.
      const socials: Record<string, string> = {};
      for (const plat of ['facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'github', 'tiktok', 'pinterest', 'whatsapp', 'telegram']) {
        const val = t[`contact:${plat}`] || t[plat];
        if (val) socials[plat] = /^https?:/i.test(val) ? val : `https://${plat === 'twitter' ? 'x' : plat}.com/${String(val).replace(/^@/, '')}`;
      }
      if (!website && !phone && !email && Object.keys(socials).length === 0) continue;
      const key = (name + '|' + (website || phone || '')).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const p = el.center || el;
      candidates.push({
        category: opts.category,
        name,
        email,
        phone,
        website,
        location: opts.geo,
        geo: opts.geo,
        lat: typeof p.lat === 'number' ? p.lat : null,
        lng: typeof p.lon === 'number' ? p.lon : null,
        source_key: 'osm_overpass',
        source_url: website || `https://www.openstreetmap.org/${el.type}/${el.id}`,
        socials,
        raw: { osm_id: el.id, osm_type: el.type, tags: t },
      });
      if (candidates.length >= limit) break;
    }
    return { candidates, status: candidates.length ? 'ok' : 'empty' };
  } catch (e: any) {
    return { candidates: [], status: 'error', error: e?.message || 'overpass fetch failed' };
  }
}
