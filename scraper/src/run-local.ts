// Local dev harness: run ONE real scrape headed so the owner can watch it.
//   HEADLESS=false SUPABASE_DB_URL=... GEO="Austin, TX" LIMIT=12 npx tsx src/run-local.ts
import { geocode } from './core/geocode';
import { overpassSearch } from './adapters/overpass';
import { launchBrowser } from './browser';
import { enrichFromWebsite } from './adapters/websiteEnrich';
import { toUpsertPayload, validateBatch } from './quality/dedupe';
import { attachBriefs } from './sink/briefs';
import { upsertLead, updateSourceHealth, closeDb } from './sink/db';
import { pace } from './core/pacing';

const category = process.env.CATEGORY || 'b2b';
const geo = process.env.GEO || 'Austin, TX';
const limit = Number(process.env.LIMIT || 12);
const scrape_env = 'manual' as const;

async function main() {
  console.log(`\n== Lead scrape (local) ==  category=${category}  geo="${geo}"  limit=${limit}\n`);

  const loc = await geocode(geo);
  if (!loc) throw new Error(`geocode failed for "${geo}"`);
  console.log(`geocoded → ${loc.lat}, ${loc.lng}`);

  const seed = await overpassSearch({ category, lat: loc.lat, lng: loc.lng, geo, limit });
  console.log(`overpass: status=${seed.status}  candidates=${seed.candidates.length}`);
  await updateSourceHealth('osm_overpass', seed.status, seed.candidates.length, seed.error);
  const v = validateBatch(seed.candidates);
  if (!v.ok) { console.error('batch invalid:', v.reason); return; }

  // Enrichment (headed) — visit each business site to find an email/phone.
  const ctx = await launchBrowser();
  let enriched = 0;
  try {
    for (const c of seed.candidates) {
      if (c.website && !c.email) {
        try {
          const e = await enrichFromWebsite(ctx, c.website);
          if (e.email) { c.email = e.email; enriched++; }
          if (!c.phone && e.phone) c.phone = e.phone;
          c.socials = { ...e.socials, ...(c.socials || {}) }; // OSM socials win, website fills gaps
          const soc = Object.keys(c.socials);
          console.log(`  enrich · ${c.name}  → email=${e.email || '—'}  phone=${e.phone || '—'}  socials=[${soc.join(', ') || '—'}]`);
        } catch (err: any) { console.log(`  enrich · ${c.name} failed: ${err?.message}`); }
        await pace(1500, 4000);
      }
    }
  } finally {
    await ctx.close();
  }
  console.log(`enriched ${enriched} site(s) with an email`);
  await updateSourceHealth('website_enrich', 'ok', enriched);

  // Quality pipeline → payloads.
  const payloads = [];
  for (const c of seed.candidates) {
    const p = await toUpsertPayload(c, { scrape_env });
    if (p) payloads.push(p);
  }
  console.log(`${payloads.length} lead(s) passed the quality filter`);

  await attachBriefs(payloads, { key: category, label: 'B2B Contacts' });

  let ins = 0, upd = 0;
  for (const p of payloads) {
    try { const r = await upsertLead(p); r.was_insert ? ins++ : upd++; }
    catch (e: any) { console.log(`  upsert failed for ${p.name}: ${e.message}`); }
  }
  console.log(`\n✅ done: ${ins} inserted, ${upd} merged, ${payloads.length} total\n`);
}

main().catch((e) => { console.error('FATAL', e); process.exitCode = 1; }).finally(() => closeDb());
