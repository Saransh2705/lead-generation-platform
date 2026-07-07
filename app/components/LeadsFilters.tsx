'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Opt = { value: string; label: string };
type Col = { key: string; header: string };

type Geo = { country: string; state: string; city: string };
export default function LeadsFilters(props: {
  category: string; status: string; has: string; date: string; conf: string; src: string; mode: string;
  country: string; state: string; city: string; geoTree: Geo[]; from: string; to: string; cols: string[];
  categoryOpts: Opt[]; statusOpts: Opt[]; contactOpts: Opt[]; dateOpts: Opt[]; confOpts: Opt[]; sourceOpts: Opt[]; modeOpts: Opt[]; allCols: Col[];
}) {
  const { category, status, has, date, conf, src, mode, country, state, city, geoTree, from, to, cols, categoryOpts, statusOpts, contactOpts, dateOpts, confOpts, sourceOpts, modeOpts, allCols } = props;
  const uniq = (a: string[]) => [...new Set(a.filter(Boolean))].sort();
  const countryList = uniq(geoTree.map((g) => g.country));
  const stateList = uniq(geoTree.filter((g) => country === 'all' || g.country === country).map((g) => g.state));
  const cityList = uniq(geoTree.filter((g) => (country === 'all' || g.country === country) && (state === 'all' || g.state === state)).map((g) => g.city));
  const router = useRouter();
  const [colsOpen, setColsOpen] = useState(false);
  const colsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (colsRef.current && !colsRef.current.contains(e.target as Node)) setColsOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Build the next URL from current state + overrides, then navigate.
  const nav = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    p.set('category', category); p.set('status', status); p.set('has', has); p.set('date', date);
    p.set('conf', conf); p.set('src', src); p.set('mode', mode);
    p.set('country', country); p.set('state', state); p.set('city', city);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    p.set('cols', cols.join(','));
    for (const [k, v] of Object.entries(over)) { if (v === '') p.delete(k); else p.set(k, v); }
    router.push(`/leads?${p.toString()}`);
  };

  const toggleCol = (key: string) => {
    const set = new Set(cols);
    set.has(key) ? set.delete(key) : set.add(key);
    const next = allCols.map((c) => c.key).filter((k) => set.has(k));
    nav({ cols: next.join(',') || 'name' });
  };

  const sel: React.CSSProperties = { minWidth: 168, cursor: 'pointer', padding: '9px 12px' };
  const Group = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span className="field-label">{label}</span>
      {children}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
      <Group label="Category">
        <select style={sel} value={category} onChange={(e) => nav({ category: e.target.value })}>
          {categoryOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Group>

      <Group label="Country">
        <select style={sel} value={country} onChange={(e) => nav({ country: e.target.value, state: 'all', city: 'all' })}>
          <option value="all">All countries</option>
          {countryList.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Group>

      <Group label="State / region">
        <select style={sel} value={state} onChange={(e) => nav({ state: e.target.value, city: 'all' })} disabled={stateList.length === 0}>
          <option value="all">All states</option>
          {stateList.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Group>

      <Group label="City">
        <select style={sel} value={city} onChange={(e) => nav({ city: e.target.value })} disabled={cityList.length === 0}>
          <option value="all">All cities</option>
          {cityList.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Group>

      <Group label="Status">
        <select style={sel} value={status} onChange={(e) => nav({ status: e.target.value })}>
          {statusOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Group>

      <Group label="Confidence">
        <select style={sel} value={conf} onChange={(e) => nav({ conf: e.target.value })}>
          {confOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Group>

      <Group label="Source">
        <select style={sel} value={src} onChange={(e) => nav({ src: e.target.value })}>
          {sourceOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Group>

      <Group label="Mode">
        <select style={sel} value={mode} onChange={(e) => nav({ mode: e.target.value })}>
          {modeOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Group>

      <Group label="Contacts">
        <select style={sel} value={has} onChange={(e) => nav({ has: e.target.value })}>
          {contactOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Group>

      <Group label="Date fetched">
        <select style={sel} value={date} onChange={(e) => nav({ date: e.target.value, from: '', to: '' })}>
          {dateOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Group>

      {date === 'custom' && (
        <>
          <Group label="From">
            <input type="date" value={from} max={to || undefined} onChange={(e) => nav({ from: e.target.value })} />
          </Group>
          <Group label="To">
            <input type="date" value={to} min={from || undefined} onChange={(e) => nav({ to: e.target.value })} />
          </Group>
        </>
      )}

      <Group label="Columns">
        <div ref={colsRef} style={{ position: 'relative' }}>
          <button type="button" className="btn-ghost btn-sm" style={{ padding: '9px 14px' }} onClick={() => setColsOpen((o) => !o)}>
            {cols.length} shown ▾
          </button>
          {colsOpen && (
            <div style={{ position: 'absolute', left: 0, top: '110%', zIndex: 50, background: '#fff', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 12px 30px rgba(16,24,40,0.14)', minWidth: 190, overflow: 'hidden', padding: '4px 0' }}>
              {allCols.map((c) => (
                <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 13px', cursor: 'pointer', fontSize: 13.5, fontWeight: 500 }}>
                  <input type="checkbox" checked={cols.includes(c.key)} onChange={() => toggleCol(c.key)} style={{ width: 15, height: 15, padding: 0, accentColor: 'var(--brand)', cursor: 'pointer' }} />
                  {c.header}
                </label>
              ))}
            </div>
          )}
        </div>
      </Group>
    </div>
  );
}
