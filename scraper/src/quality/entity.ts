// Convergent dedup key. Order-independent: two records for the same business
// from different sources compute the SAME key. Ladder:
//   1. dom:<registrable-domain>   (only if the business OWNS the domain — not a shared host)
//   2. tel:<e164>|<name-token>    (never phone-alone; a shared line won't merge two names)
//   3. nc:<name-token>|<geocell>  (name + ~1km cell)
// If none can be formed, returns null (caller skips — can't dedup safely).
import { nameToken, geocell } from './normalize';
import { isSharedHost } from './disposable';

export type EntityInput = {
  name?: string | null;
  website_domain?: string | null;
  phone_e164?: string | null;
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
};

export function entityKey(i: EntityInput): string | null {
  const dom = i.website_domain ? i.website_domain.toLowerCase().replace(/^www\./, '') : null;
  if (dom && !isSharedHost(dom)) return `dom:${dom}`;
  const nt = nameToken(i.name);
  if (i.phone_e164 && nt) return `tel:${i.phone_e164}|${nt}`;
  const cell = geocell(i.lat, i.lng, i.city);
  if (nt && cell) return `nc:${nt}|${cell}`;
  return null;
}
