'use client';

import { useState } from 'react';
import CategoryForm from './CategoryForm';
import RunButton from './RunButton';

type Cat = { key: string; label: string; icon?: string; search_terms?: string; osm_filter?: string; geo?: string; country?: string; lat?: number; lng?: number; lead_count?: number; leadCount?: number; lastRun?: string | null };

export default function CategoryManager({ categories, sources, createAction, updateAction, deleteAction }: {
  categories: Cat[];
  sources: { key: string; label: string; icon?: string }[];
  createAction: (fd: FormData) => Promise<void>;
  updateAction: (fd: FormData) => Promise<void>;
  deleteAction: (fd: FormData) => Promise<void>;
}) {
  const [q, setQ] = useState('');
  const [showCreate, setShowCreate] = useState(categories.length === 0);
  const [editing, setEditing] = useState<string | null>(null);

  const filtered = categories.filter((c) =>
    !q.trim() || `${c.label} ${c.search_terms || ''} ${c.geo || ''} ${c.country || ''}`.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="row-between" style={{ marginBottom: showCreate ? 16 : 0 }}>
          <div>
            <div className="card-title">Create a category</div>
            <div className="card-sub" style={{ margin: 0 }}>A category is a <strong>business type + a location</strong> to scrape (e.g. “dentist” in Austin, TX).</div>
          </div>
          <button type="button" className="btn-ghost btn-sm" onClick={() => setShowCreate((v) => !v)}>{showCreate ? 'Hide' : '＋ New category'}</button>
        </div>
        {showCreate && <CategoryForm action={createAction} sources={sources} onSubmitted={() => setShowCreate(false)} />}
      </div>

      <div style={{ marginBottom: 16 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍  Search categories by name, business type, or city…" style={{ width: '100%', padding: '11px 14px' }} />
      </div>

      <div className="cat-grid">
        {filtered.length === 0 && (
          <div className="empty" style={{ gridColumn: '1 / -1' }}>
            {categories.length === 0 ? 'No categories yet — create one above.' : 'No categories match your search.'}
          </div>
        )}
        {filtered.map((c) => (
          <div key={c.key} className="cat-card">
            {editing === c.key ? (
              <>
                <div className="card-title" style={{ marginBottom: 10 }}>Edit category</div>
                <CategoryForm action={updateAction} initial={c} sources={sources} compact onSubmitted={() => setEditing(null)} />
                <button type="button" className="btn-ghost btn-sm" style={{ marginTop: 8, width: '100%' }} onClick={() => setEditing(null)}>Cancel</button>
              </>
            ) : (
              <>
                <div className="cat-icon">{c.icon || '📋'}</div>
                <div className="cat-name">{c.label}</div>
                <div className="cat-blurb">
                  {c.search_terms ? <>Scrapes “<strong>{c.search_terms}</strong>”</> : <span style={{ color: 'var(--red)' }}>No business type set</span>}
                  {c.geo ? ` · ${c.geo}` : ''}{c.country ? `, ${c.country}` : ''}
                </div>
                <div className="cat-meta">
                  {typeof c.leadCount === 'number' ? `${c.leadCount} leads` : '0 leads'}
                  {c.lastRun ? ` · last ${c.lastRun}` : ''}
                  {c.lat == null ? ' · ⚠ set a location to run' : ''}
                </div>
                <RunButton categoryKey={c.key} />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button type="button" className="btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setEditing(c.key)}>Edit</button>
                  <form action={deleteAction} style={{ flex: 1 }}>
                    <input type="hidden" name="key" value={c.key} />
                    <button type="submit" className="btn-danger btn-sm" style={{ width: '100%' }}>Delete</button>
                  </form>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
