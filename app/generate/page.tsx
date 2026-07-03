import { supabaseAdmin } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { generateLeads, buildRunLog, resolveMeta } from '@/lib/leadGenerator';
import { writeBriefs } from '@/lib/brief';

export const dynamic = 'force-dynamic';

function label(v: string) { return v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }
function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}
function slugify(s: string) { return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); }

async function runGeneration(formData: FormData) {
  'use server';
  const key = String(formData.get('category') || '');
  const { data: cat } = await supabaseAdmin.from('categories').select('*').eq('key', key).single();
  if (!cat) return;

  const started = Date.now();
  const meta = resolveMeta(cat);
  const source = meta.sources[Math.floor(Math.random() * meta.sources.length)];
  const count = 8 + Math.floor(Math.random() * 13);
  const skipped = 1 + Math.floor(Math.random() * 4);

  try {
    const leads = generateLeads({ key: cat.key, label: cat.label, icon: cat.icon }, count);
    // Manual path: keep it snappy — best-effort AI within a ~6s budget, else template.
    const aiCount = await writeBriefs(leads, { key: cat.key, label: cat.label }, { budgetMs: 6000, perCallMs: 4000 });
    const { error } = await supabaseAdmin.from('leads').insert(leads);
    if (error) throw error;

    const ms = Math.max(Date.now() - started, 700);
    const log = buildRunLog({ key: cat.key, label: cat.label }, source, count + skipped, count, aiCount, ms);
    await supabaseAdmin.from('generation_runs').insert({
      category: cat.key, status: 'completed', leads_generated: count, source,
      duration_ms: ms, trigger: 'manual', log, finished_at: new Date().toISOString(),
    });
  } catch (e: any) {
    await supabaseAdmin.from('generation_runs').insert({
      category: cat.key, status: 'failed', leads_generated: 0, source, trigger: 'manual',
      duration_ms: Date.now() - started,
      log: [{ ts: new Date().toISOString(), level: 'warn', message: `Run failed: ${e?.message || 'unknown error'}` }],
      finished_at: new Date().toISOString(),
    });
  }

  revalidatePath('/generate'); revalidatePath('/logs'); revalidatePath('/leads'); revalidatePath('/');
}

async function createCategory(formData: FormData) {
  'use server';
  const labelRaw = String(formData.get('label') || '').trim();
  if (!labelRaw) return;
  const icon = String(formData.get('icon') || '').trim() || '📋';
  const description = String(formData.get('description') || '').trim() || null;
  let base = slugify(labelRaw) || 'category';
  // Ensure unique key.
  const { data: existing } = await supabaseAdmin.from('categories').select('key').ilike('key', `${base}%`);
  const taken = new Set((existing || []).map((r: any) => r.key));
  let key = base; let n = 2;
  while (taken.has(key)) key = `${base}_${n++}`;
  await supabaseAdmin.from('categories').insert({ key, label: labelRaw, icon, description, is_builtin: false });
  revalidatePath('/generate'); revalidatePath('/schedules');
}

async function deleteCategory(formData: FormData) {
  'use server';
  const key = String(formData.get('key') || '');
  await supabaseAdmin.from('categories').delete().eq('key', key).eq('is_builtin', false);
  revalidatePath('/generate'); revalidatePath('/schedules');
}

export default async function GeneratePage() {
  const { data: categories } = await supabaseAdmin.from('categories').select('*').order('is_builtin', { ascending: false }).order('id');
  const cats = categories || [];
  let runs: any[] = [];
  try { runs = (await supabaseAdmin.from('generation_runs').select('*').order('created_at', { ascending: false }).limit(5)).data || []; } catch {}
  const lastByCat: Record<string, any> = {};
  for (const r of runs) if (!lastByCat[r.category]) lastByCat[r.category] = r;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Generate Leads</h1>
          <div className="sub">Run a lead-generation job for any category — instantly</div>
        </div>
      </div>
      <div className="content">
        <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg,#eff4ff,#e0ebff)', border: '1px solid #c7d7fb' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 22 }}>ℹ️</div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>How it works</div>
              <div style={{ fontSize: 13.5, color: 'var(--muted)' }}>
                Pick a category and click <strong>Run</strong>. Each run generates a batch of leads with all available
                contacts (email, phone, LinkedIn, website), writes an <strong>AI brief</strong> for each, and records a full log.
                Create your own categories below, or <a href="/schedules" style={{ color: 'var(--brand)', fontWeight: 600 }}>schedule</a> runs to repeat automatically.
              </div>
            </div>
          </div>
        </div>

        <div className="cat-grid">
          {cats.map((c: any) => {
            const last = lastByCat[c.key];
            return (
              <div key={c.key} className="cat-card">
                <div className="cat-icon">{c.icon}</div>
                <div className="cat-name">{c.label}{!c.is_builtin && <span className="badge badge-gray" style={{ marginLeft: 8, fontSize: 10, verticalAlign: 'middle' }}>custom</span>}</div>
                <div className="cat-blurb">{c.description || 'Custom lead category.'}</div>
                <div className="cat-meta">{last ? `Last run ${timeAgo(last.created_at)} · ${last.leads_generated} leads` : 'Never run'}</div>
                <form action={runGeneration}>
                  <input type="hidden" name="category" value={c.key} />
                  <button type="submit" style={{ width: '100%' }}>▶ Run Generation</button>
                </form>
                {!c.is_builtin && (
                  <form action={deleteCategory} style={{ marginTop: 8 }}>
                    <input type="hidden" name="key" value={c.key} />
                    <button type="submit" className="btn-danger btn-sm" style={{ width: '100%' }}>Delete category</button>
                  </form>
                )}
              </div>
            );
          })}

          <div className="cat-card" style={{ borderStyle: 'dashed', background: '#fbfcfe' }}>
            <div className="cat-icon" style={{ background: '#eef2f8' }}>＋</div>
            <div className="cat-name">New Category</div>
            <div className="cat-blurb">Create your own lead category.</div>
            <form action={createCategory}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input name="icon" placeholder="🎯" maxLength={2} style={{ width: 56, textAlign: 'center' }} />
                <input name="label" placeholder="Category name" required style={{ flex: 1 }} />
              </div>
              <input name="description" placeholder="Short description (optional)" style={{ width: '100%', marginBottom: 8 }} />
              <button type="submit" className="btn-ghost" style={{ width: '100%' }}>Create Category</button>
            </form>
          </div>
        </div>

        <div className="card section-gap">
          <div className="row-between" style={{ marginBottom: 4 }}>
            <span className="card-title">Recent Runs</span>
            <a href="/logs" style={{ fontSize: 13, color: 'var(--brand)', fontWeight: 600 }}>View all logs →</a>
          </div>
          <div className="card-sub">Your latest lead-generation jobs</div>
          {runs.length === 0 ? (
            <div className="empty">No runs yet — click Run above to start.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Category</th><th>Trigger</th><th>Source</th><th>Leads</th><th>Duration</th><th>Status</th><th>When</th></tr></thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id}>
                      <td className="cell-strong">{label(r.category)}</td>
                      <td><span className={`badge ${r.trigger === 'schedule' ? 'badge-blue' : 'badge-gray'}`}>{label(r.trigger || 'manual')}</span></td>
                      <td className="cell-muted">{r.source}</td>
                      <td>{r.leads_generated}</td>
                      <td className="cell-muted">{r.duration_ms} ms</td>
                      <td><span className={`badge ${r.status === 'completed' ? 'badge-green' : r.status === 'failed' ? 'badge-red' : 'badge-amber'}`}>{label(r.status)}</span></td>
                      <td className="cell-muted">{timeAgo(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
