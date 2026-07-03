'use client';

import { useEffect, useRef, useState } from 'react';

type Field = { key: string; header: string };

function cell(v: any): string {
  if (v === null || v === undefined) return '';
  return String(v);
}
function toCSV(rows: any[], fields: Field[], sep = ','): string {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const head = fields.map((f) => esc(f.header)).join(sep);
  const body = rows.map((r) => fields.map((f) => esc(cell(r[f.key]))).join(sep)).join('\n');
  return `${head}\n${body}`;
}
function toTSV(rows: any[], fields: Field[]): string {
  // Tab-separated, no quoting — pastes cleanly into Google Sheets.
  const clean = (s: string) => s.replace(/\t/g, ' ').replace(/\n/g, ' ');
  const head = fields.map((f) => clean(f.header)).join('\t');
  const body = rows.map((r) => fields.map((f) => clean(cell(r[f.key]))).join('\t')).join('\n');
  return `${head}\n${body}`;
}
function toJSON(rows: any[], fields: Field[]): string {
  const keys = fields.map((f) => f.key);
  return JSON.stringify(rows.map((r) => Object.fromEntries(keys.map((k) => [k, r[k] ?? null]))), null, 2);
}
function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ExportMenu({ rows, fields }: { rows: any[]; fields: Field[] }) {
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); setFlash(`${label} copied!`); }
    catch { setFlash('Copy failed'); }
    setTimeout(() => setFlash(''), 1800);
    setOpen(false);
  };

  const stamp = new Date().toISOString().slice(0, 10);
  const item: React.CSSProperties = { display: 'block', width: '100%', textAlign: 'left', background: 'none', color: 'var(--text)', boxShadow: 'none', padding: '9px 14px', borderRadius: 0, fontWeight: 500, fontSize: 13.5 };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button className="btn-ghost btn-sm" onClick={() => setOpen((o) => !o)}>⬇ Export ({rows.length}) ▾</button>
      {flash && <span style={{ marginLeft: 10, color: 'var(--green)', fontSize: 13, fontWeight: 600 }}>{flash}</span>}
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 50, background: '#fff', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 12px 30px rgba(16,24,40,0.14)', minWidth: 210, overflow: 'hidden', padding: '4px 0' }}>
          <button style={item} onClick={() => { download(toCSV(rows, fields), `leads-${stamp}.csv`, 'text/csv'); setOpen(false); }}>⬇ Download CSV</button>
          <button style={item} onClick={() => { download(toJSON(rows, fields), `leads-${stamp}.json`, 'application/json'); setOpen(false); }}>⬇ Download JSON</button>
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
          <button style={item} onClick={() => copy(toCSV(rows, fields), 'CSV')}>📋 Copy CSV</button>
          <button style={item} onClick={() => copy(toJSON(rows, fields), 'JSON')}>📋 Copy JSON</button>
          <button style={item} onClick={() => copy(toTSV(rows, fields), 'Sheets rows')}>📊 Copy for Sheets</button>
        </div>
      )}
    </div>
  );
}
