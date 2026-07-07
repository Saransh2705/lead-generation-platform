// The ingest pipeline: RawCandidate → normalize → verify → score → entity_key →
// UpsertPayload (ready for the DB `upsert_lead` RPC). Returns null to DROP a
// candidate (no usable contact, unresolvable entity, or placeholder-only email).
import type { RawCandidate, UpsertPayload } from './types';
import { normalizeName, normalizeCity, websiteDomain, emailNorm, geocell } from './normalize';
import { verifyEmail } from './verifyEmail';
import { verifyPhone } from './verifyPhone';
import { entityKey } from './entity';
import { computeConfidence } from './confidence';
import { isPlaceholderEmail } from './disposable';

const SOURCE_TRUST: Record<string, number> = {
  google_maps: 0.7, osm_overpass: 0.6, yellowpages: 0.55, website_enrich: 0.4,
};

export async function toUpsertPayload(
  c: RawCandidate,
  opts: { scrape_env: 'cloud' | 'home' | 'manual'; scrape_job_id?: number | null }
): Promise<UpsertPayload | null> {
  // Drop placeholder / web-dev / asset emails before they pollute anything.
  let email = emailNorm(c.email);
  if (email && isPlaceholderEmail(email)) email = null;

  const website_domain = websiteDomain(c.website);
  const name_norm = normalizeName(c.name);
  const city_norm = normalizeCity(c.location || c.geo);
  const cell = geocell(c.lat, c.lng, c.location || c.geo);

  const ev = await verifyEmail(email);
  const pv = verifyPhone(c.phone, c.geo || c.location);

  const hasEmail = !!email && ev.email_status !== 'invalid_syntax';
  const hasPhone = !!c.phone;
  if (!hasEmail && !hasPhone) return null; // DB email_or_phone CHECK would reject

  const ek = entityKey({ name: c.name, website_domain, phone_e164: pv.phone_e164, lat: c.lat, lng: c.lng, city: c.location || c.geo });
  if (!ek) return null; // cannot dedup safely → skip

  const { confidence, is_spam_risk } = computeConfidence({
    email_status: hasEmail ? ev.email_status : null,
    mx_found: ev.mx_found,
    phone_status: hasPhone ? pv.phone_status : null,
    has_website: !!website_domain,
    has_name: !!name_norm,
    is_disposable: ev.is_disposable,
    is_role_account: ev.is_role_account,
    is_placeholder: false,
    phone_country_defaulted: pv.country_defaulted,
  });

  const now = new Date().toISOString();
  const socials = c.socials ?? {};
  return {
    category: c.category,
    name: c.name ?? null,
    email: hasEmail ? email : null,
    phone: c.phone ?? null,
    linkedin_url: c.linkedin_url ?? socials.linkedin ?? null,
    socials,
    website: c.website ?? null,
    company: c.company ?? c.name ?? null,
    location: c.location ?? c.geo ?? null,
    country: c.country ?? null,
    state: c.state ?? null,
    city: c.city ?? null,
    source: c.source_key,
    source_key: c.source_key,
    source_url: c.source_url ?? null,
    brief: null,
    status: 'new',
    mode: 'scraped',
    scrape_env: opts.scrape_env,
    scrape_job_id: opts.scrape_job_id ?? null,
    name_norm,
    email_norm: hasEmail ? email : null,
    email_domain: ev.email_domain,
    website_domain,
    city_norm,
    geocell: cell,
    phone_e164: pv.phone_e164,
    phone_line_type: pv.phone_line_type,
    entity_key: ek,
    name_source_trust: SOURCE_TRUST[c.source_key] ?? 0.4,
    email_status: hasEmail ? ev.email_status : null,
    mx_found: ev.mx_found,
    is_disposable: ev.is_disposable,
    is_role_account: ev.is_role_account,
    phone_status: hasPhone ? pv.phone_status : null,
    confidence,
    is_spam_risk,
    enriched_at: now,
    verified_at: now,
  };
}

export function validateBatch(items: RawCandidate[]): { ok: boolean; reason?: string } {
  if (!items || items.length === 0) return { ok: false, reason: 'empty_batch' };
  return { ok: true };
}
