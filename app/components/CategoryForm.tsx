'use client';

import { useState } from 'react';
import LocationPicker from './LocationPicker';

type Initial = { key?: string; label?: string; icon?: string; search_terms?: string; osm_filter?: string; geo?: string; country?: string; state?: string; city?: string; lat?: number; lng?: number; radius_m?: number; lead_count?: number };

// Create/edit a category (= a scrape definition). Location is chosen via cascading
// Country → State → City dropdowns (coords built in, no geocoding).
export default function CategoryForm({ action, initial, compact, onSubmitted }: {
  action: (fd: FormData) => Promise<void>;
  initial?: Initial;
  compact?: boolean;
  onSubmitted?: () => void;
}) {
  const [ready, setReady] = useState(initial?.lat != null && initial?.lng != null);

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

      {!compact && <input type="hidden" name="lead_count" value={initial?.lead_count ?? 12} />}

      <button type="submit" disabled={!ready} style={{ width: compact ? '100%' : 'auto' }}>
        {initial?.key ? 'Save changes' : 'Create category'}
      </button>
      {!ready && <span style={{ fontSize: 12, color: 'var(--muted-soft)', marginLeft: 10 }}>Pick a country to enable</span>}
    </form>
  );
}
