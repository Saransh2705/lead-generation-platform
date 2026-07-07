'use client';

import { useState } from 'react';

type Initial = { key?: string; label?: string; icon?: string; search_terms?: string; osm_filter?: string; geo?: string; country?: string; lat?: number; lng?: number; lead_count?: number };

// Create/edit a category (= a scrape definition). Geocodes the city IN THE BROWSER
// (Nominatim blocks datacenter IPs), storing lat/lng so the cloud worker never geocodes.
export default function CategoryForm({ action, initial, compact, onSubmitted }: {
  action: (fd: FormData) => Promise<void>;
  initial?: Initial;
  compact?: boolean;
  onSubmitted?: () => void;
}) {
  const [city, setCity] = useState(initial?.geo || '');
  const [country, setCountry] = useState(initial?.country || '');
  const [loc, setLoc] = useState<{ lat: number; lng: number; display: string } | null>(
    initial?.lat != null && initial?.lng != null ? { lat: initial.lat, lng: initial.lng, display: initial.geo || '' } : null
  );
  const [geoErr, setGeoErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function locate() {
    if (!city.trim()) { setGeoErr('Enter a city first'); return; }
    setBusy(true); setGeoErr(''); setLoc(null);
    try {
      const q = encodeURIComponent(`${city}${country ? ', ' + country : ''}`);
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`, { headers: { Accept: 'application/json' } });
      const d = await r.json();
      if (!d?.length) setGeoErr('Location not found — try "City, State" or add a country');
      else setLoc({ lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon), display: d[0].display_name });
    } catch { setGeoErr('Geocoding failed — check your connection'); } finally { setBusy(false); }
  }

  return (
    <form action={action} onSubmit={() => onSubmitted?.()}>
      {initial?.key && <input type="hidden" name="key" value={initial.key} />}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 12, marginBottom: 12 }}>
        <div>
          <label className="field-label">Icon</label>
          <input name="icon" placeholder="🦷" maxLength={2} defaultValue={initial?.icon || ''} style={{ width: 64, textAlign: 'center' }} />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label className="field-label">Category name</label>
          <input name="label" required placeholder="e.g. Austin Dentists" defaultValue={initial?.label || ''} style={{ width: '100%' }} />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label className="field-label">Business type to find</label>
          <input name="search_terms" required placeholder="e.g. dentist, solar installer, law firm" defaultValue={initial?.search_terms || ''} style={{ width: '100%' }} />
        </div>
        <div>
          <label className="field-label">Advanced OSM filter (optional)</label>
          <input name="osm_filter" placeholder="[amenity=dentist]" defaultValue={initial?.osm_filter || ''} style={{ width: '100%' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr auto', gap: 12, alignItems: 'end', marginBottom: 10 }}>
        <div>
          <label className="field-label">City / area</label>
          <input value={city} onChange={(e) => { setCity(e.target.value); setLoc(null); }} required placeholder="Austin, TX" style={{ width: '100%' }} />
        </div>
        <div>
          <label className="field-label">Country</label>
          <input value={country} onChange={(e) => { setCountry(e.target.value); setLoc(null); }} placeholder="United States" style={{ width: '100%' }} />
        </div>
        <button type="button" className="btn-ghost" onClick={locate} disabled={busy}>{busy ? 'Locating…' : '📍 Locate'}</button>
      </div>

      {geoErr && <div style={{ fontSize: 12.5, color: 'var(--red)', marginBottom: 8 }}>{geoErr}</div>}
      {loc && <div style={{ fontSize: 12.5, color: 'var(--green)', marginBottom: 8 }}>📍 {loc.display} ({loc.lat.toFixed(3)}, {loc.lng.toFixed(3)})</div>}

      <input type="hidden" name="geo" value={city} />
      <input type="hidden" name="country" value={country} />
      <input type="hidden" name="lat" value={loc?.lat ?? ''} />
      <input type="hidden" name="lng" value={loc?.lng ?? ''} />
      {!compact && (
        <input type="hidden" name="lead_count" value={initial?.lead_count ?? 12} />
      )}

      <button type="submit" disabled={!loc} style={{ width: compact ? '100%' : 'auto' }}>
        {initial?.key ? 'Save changes' : 'Create category'}
      </button>
      {!loc && <span style={{ fontSize: 12, color: 'var(--muted-soft)', marginLeft: 10 }}>Locate the city to enable</span>}
    </form>
  );
}
