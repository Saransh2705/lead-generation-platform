'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Combobox from './Combobox';

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

  const Group = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span className="field-label">{label}</span>
      {children}
    </div>
  );

  const geoOpt = (all: string, list: string[]) => [{ value: 'all', label: all }, ...list.map((v) => ({ value: v, label: v }))];

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
      <Group label="Category">
        <Combobox value={category} options={categoryOpts} onChange={(v) => nav({ category: v })} />
      </Group>

      <Group label="Country">
        <Combobox value={country} options={geoOpt('All countries', countryList)} onChange={(v) => nav({ country: v, state: 'all', city: 'all' })} />
      </Group>

      <Group label="State / region">
        <Combobox value={state} options={geoOpt('All states', stateList)} disabled={stateList.length === 0} onChange={(v) => nav({ state: v, city: 'all' })} />
      </Group>

      <Group label="City">
        <Combobox value={city} options={geoOpt('All cities', cityList)} disabled={cityList.length === 0} onChange={(v) => nav({ city: v })} />
      </Group>

      <Group label="Status">
        <Combobox value={status} options={statusOpts} onChange={(v) => nav({ status: v })} />
      </Group>

      <Group label="Confidence">
        <Combobox value={conf} options={confOpts} onChange={(v) => nav({ conf: v })} />
      </Group>

      <Group label="Source">
        <Combobox value={src} options={sourceOpts} onChange={(v) => nav({ src: v })} />
      </Group>

      <Group label="Mode">
        <Combobox value={mode} options={modeOpts} onChange={(v) => nav({ mode: v })} />
      </Group>

      <Group label="Contacts">
        <Combobox value={has} options={contactOpts} onChange={(v) => nav({ has: v })} />
      </Group>

      <Group label="Date fetched">
        <Combobox value={date} options={dateOpts} onChange={(v) => nav({ date: v, from: '', to: '' })} />
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
