'use client';

import { useState } from 'react';
import LocationPicker from './LocationPicker';

type Src = { key: string; label: string; icon?: string };
type Initial = { key?: string; label?: string; icon?: string; search_terms?: string; osm_filter?: string; geo?: string; country?: string; state?: string; city?: string; lat?: number; lng?: number; radius_m?: number; lead_count?: number; source_keys?: string[] };

// Create/edit a category (= a scrape definition). Location via cascading dropdowns
// (coords built in, no geocoding); one or more sources to scrape.
export default function CategoryForm({ action, initial, sources, compact, onSubmitted }: {
  action: (fd: FormData) => Promise<void>;
  initial?: Initial;
  sources: Src[];
  compact?: boolean;
  onSubmitted?: () => void;
}) {
  const [ready, setReady] = useState(initial?.lat != null && initial?.lng != null);
  const allKeys = sources.map((s) => s.key);
  const [sel, setSel] = useState<string[]>(initial?.source_keys?.length ? initial.source_keys.filter((k) => allKeys.includes(k)) : allKeys);
  const toggle = (k: string) => setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const allOn = allKeys.length > 0 && sel.length === allKeys.length;

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

      <div style={{ marginBottom: 12 }}>
        <LocationPicker initial={initial} onReady={setReady} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label className="field-label">Sources to scrape</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
          <button type="button" onClick={() => setSel(allOn ? [] : allKeys)}
            className={`chip${allOn ? ' active' : ''}`} style={{ cursor: 'pointer' }}>All sources</button>
          {sources.map((s) => {
            const on = sel.includes(s.key);
            return (
              <button type="button" key={s.key} onClick={() => toggle(s.key)}
                className={`chip${on ? ' active' : ''}`} style={{ cursor: 'pointer' }}>{s.icon} {s.label}</button>
            );
          })}
        </div>
        {sel.map((k) => <input key={k} type="hidden" name="source_keys" value={k} />)}
        {sel.length === 0 && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 6 }}>Pick at least one source.</div>}
      </div>

      {!compact && <input type="hidden" name="lead_count" value={initial?.lead_count ?? 12} />}

      <button type="submit" disabled={!ready || sel.length === 0} style={{ width: compact ? '100%' : 'auto' }}>
        {initial?.key ? 'Save changes' : 'Create category'}
      </button>
      {(!ready || sel.length === 0) && <span style={{ fontSize: 12, color: 'var(--muted-soft)', marginLeft: 10 }}>{!ready ? 'Pick a country to enable' : 'Pick a source'}</span>}
    </form>
  );
}
