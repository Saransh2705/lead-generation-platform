// Normalization helpers that drive dedup. Deterministic, no network.
import psl from 'psl';

const LEGAL_SUFFIXES = /\b(llc|l\.l\.c|inc|inc\.|incorporated|ltd|ltd\.|limited|co|co\.|corp|corp\.|corporation|company|pllc|llp|lp|group|gmbh|the)\b/gi;

// Lowercase, strip legal suffixes + punctuation, collapse whitespace.
export function normalizeName(name?: string | null): string | null {
  if (!name) return null;
  const n = name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(LEGAL_SUFFIXES, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return n || null;
}

// Compact token (letters+digits) for use inside an entity_key.
export function nameToken(name?: string | null): string | null {
  const n = normalizeName(name);
  return n ? n.replace(/[^a-z0-9]/g, '') : null;
}

export function normalizeCity(location?: string | null): string | null {
  if (!location) return null;
  const c = location.toLowerCase().replace(/[^a-z0-9, ]+/g, '').replace(/\s+/g, ' ').trim();
  return c || null;
}

// Registrable domain from a URL/hostname (e.g. https://a.acme.co.uk/x → acme.co.uk).
export function websiteDomain(url?: string | null): string | null {
  if (!url) return null;
  try {
    let host = url.trim();
    if (!/^https?:\/\//i.test(host)) host = 'http://' + host;
    host = new URL(host).hostname.toLowerCase().replace(/^www\./, '');
    const parsed = psl.parse(host);
    return ('domain' in parsed && parsed.domain) ? parsed.domain : host;
  } catch {
    return null;
  }
}

export function emailNorm(email?: string | null): string | null {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+$/.test(e) ? e : null;
}

export function emailParts(email?: string | null): { local: string | null; domain: string | null } {
  const e = emailNorm(email);
  if (!e) return { local: null, domain: null };
  const [local, domain] = e.split('@');
  return { local, domain };
}

// ~1.1km grid cell from coordinates; falls back to the normalized city.
export function geocell(lat?: number | null, lng?: number | null, city?: string | null): string | null {
  if (typeof lat === 'number' && typeof lng === 'number' && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    return `${lat.toFixed(2)},${lng.toFixed(2)}`;
  }
  const c = normalizeCity(city);
  return c ? `city:${c}` : null;
}
