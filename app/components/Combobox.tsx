'use client';

import { useEffect, useRef, useState } from 'react';

export type Opt = { value: string; label: string };

// Themed, searchable dropdown that matches the app design (replaces native <select>).
export default function Combobox({ value, options, onChange, placeholder = 'Select…', disabled, minWidth = 168 }: {
  value: string;
  options: Opt[];
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQ(''); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const current = options.find((o) => o.value === value);
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : options;

  return (
    <div ref={ref} style={{ position: 'relative', minWidth, width: '100%' }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpen((o) => !o); } if (e.key === 'Escape') setOpen(false); }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          padding: '9px 12px', background: disabled ? '#f1f5f9' : '#fff',
          color: current ? 'var(--text)' : 'var(--muted-soft)',
          border: `1.5px solid ${open ? 'var(--brand)' : 'var(--border-strong)'}`, borderRadius: 10,
          fontSize: 14, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: open ? '0 0 0 4px rgba(37,99,235,0.1)' : 'none', userSelect: 'none',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current ? current.label : placeholder}</span>
        <span style={{ color: 'var(--muted-soft)', fontSize: 11, flexShrink: 0 }}>▾</span>
      </div>

      {open && !disabled && (
        <div style={{ position: 'absolute', left: 0, top: 'calc(100% + 4px)', zIndex: 60, width: '100%', minWidth: 200, background: 'var(--panel)', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 12px 30px rgba(16,24,40,0.16)', overflow: 'hidden' }}>
          {options.length > 8 && (
            <div style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" style={{ width: '100%', padding: '7px 10px', fontSize: 13 }} onClick={(e) => e.stopPropagation()} />
            </div>
          )}
          <div style={{ maxHeight: 280, overflowY: 'auto', padding: '4px 0' }}>
            {filtered.length === 0 && <div style={{ padding: '10px 14px', color: 'var(--muted-soft)', fontSize: 13 }}>No matches</div>}
            {filtered.map((o) => {
              const active = o.value === value;
              return (
                <div
                  key={o.value + o.label}
                  onClick={() => { onChange(o.value); setOpen(false); setQ(''); }}
                  style={{ padding: '8px 14px', fontSize: 13.5, cursor: 'pointer', fontWeight: active ? 600 : 500, background: active ? 'var(--brand-soft)' : 'transparent', color: active ? 'var(--brand-dark)' : 'var(--text)' }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = '#f1f5f9'; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                >
                  {o.label}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
