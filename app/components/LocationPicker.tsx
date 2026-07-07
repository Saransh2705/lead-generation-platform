'use client';

import { useEffect, useState } from 'react';
import Combobox from './Combobox';

type Opt = { name: string; iso?: string; lat: number | null; lng: number | null };
type Initial = { country?: string; state?: string; city?: string; lat?: number; lng?: number; radius_m?: number };

// Cascading Country → State → City selects. Coordinates come straight from the
// dataset (no geocoding). Deepest concrete level sets lat/lng + a scrape radius.
export default function LocationPicker({ initial, onReady }: { initial?: Initial; onReady?: (ok: boolean) => void }) {
  const [countries, setCountries] = useState<Opt[]>([]);
  const [states, setStates] = useState<Opt[]>([]);
  const [cities, setCities] = useState<Opt[]>([]);
  const [countryName, setCountryName] = useState(initial?.country || '');
  const [stateName, setStateName] = useState(initial?.state || '');
  const [cityName, setCityName] = useState(initial?.city || '');
  const [resolved, setResolved] = useState<{ lat: number; lng: number; radius: number } | null>(
    initial?.lat != null && initial?.lng != null ? { lat: initial.lat, lng: initial.lng, radius: initial.radius_m || 6000 } : null
  );

  const isoOf = (list: Opt[], name: string) => list.find((o) => o.name === name)?.iso;

  useEffect(() => { fetch('/api/geo').then((r) => r.json()).then(setCountries).catch(() => {}); }, []);
  useEffect(() => {
    const iso = isoOf(countries, countryName);
    if (iso) fetch(`/api/geo?country=${iso}`).then((r) => r.json()).then(setStates).catch(() => {});
    else setStates([]);
  }, [countryName, countries]);
  useEffect(() => {
    const ci = isoOf(countries, countryName), si = isoOf(states, stateName);
    if (ci && si) fetch(`/api/geo?country=${ci}&state=${si}`).then((r) => r.json()).then(setCities).catch(() => {});
    else setCities([]);
  }, [stateName, states]);

  useEffect(() => {
    if (!countries.length) return;
    let lat: number | null = null, lng: number | null = null, radius = 120000;
    if (cityName) { const cy = cities.find((o) => o.name === cityName); if (cy?.lat != null) { lat = cy.lat; lng = cy.lng; radius = 6000; } }
    if (lat == null && stateName) { const s = states.find((o) => o.name === stateName); if (s?.lat != null) { lat = s.lat; lng = s.lng; radius = 45000; } }
    if (lat == null && countryName) { const c = countries.find((o) => o.name === countryName); if (c?.lat != null) { lat = c.lat; lng = c.lng; radius = 120000; } }
    const r = lat != null ? { lat, lng: lng!, radius } : null;
    setResolved(r); onReady?.(!!r);
  }, [countryName, stateName, cityName, countries, states, cities]);

  const geo = [cityName, stateName, countryName].filter(Boolean).join(', ');
  const countryOpts = countries.map((c) => ({ value: c.name, label: c.name }));
  const stateOpts = [{ value: '', label: 'All states' }, ...states.map((s) => ({ value: s.name, label: s.name }))];
  const cityOpts = [{ value: '', label: 'All cities' }, ...cities.map((c) => ({ value: c.name, label: c.name }))];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
        <div>
          <label className="field-label">Country</label>
          <Combobox value={countryName} options={countryOpts} placeholder="Select country…" onChange={(v) => { setCountryName(v); setStateName(''); setCityName(''); }} />
        </div>
        <div>
          <label className="field-label">State / region</label>
          <Combobox value={stateName} options={stateOpts} disabled={!states.length} onChange={(v) => { setStateName(v); setCityName(''); }} />
        </div>
        <div>
          <label className="field-label">City</label>
          <Combobox value={cityName} options={cityOpts} disabled={!cities.length} onChange={(v) => setCityName(v)} />
        </div>
      </div>
      {resolved
        ? <div style={{ fontSize: 12.5, color: 'var(--green)', marginTop: 8 }}>📍 {geo} · ({resolved.lat.toFixed(2)}, {resolved.lng.toFixed(2)}) · radius {Math.round(resolved.radius / 1000)}km</div>
        : <div style={{ fontSize: 12.5, color: 'var(--muted-soft)', marginTop: 8 }}>Pick a country (state &amp; city optional) to target the scrape.</div>}

      <input type="hidden" name="country" value={countryName} />
      <input type="hidden" name="state" value={stateName} />
      <input type="hidden" name="city" value={cityName} />
      <input type="hidden" name="geo" value={geo} />
      <input type="hidden" name="lat" value={resolved?.lat ?? ''} />
      <input type="hidden" name="lng" value={resolved?.lng ?? ''} />
      <input type="hidden" name="radius_m" value={resolved?.radius ?? ''} />
    </div>
  );
}
