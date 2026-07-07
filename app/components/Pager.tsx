// Server-rendered pager (link-based, preserves current query params).
// Shows a windowed set of page numbers with Prev/Next/First/Last.
type Props = { total: number; page: number; pageSize: number; params: Record<string, string | undefined> };

function href(params: Record<string, string | undefined>, p: number) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '' && k !== 'page') q.set(k, String(v));
  q.set('page', String(p));
  return '?' + q.toString();
}

export default function Pager({ total, page, pageSize, params }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const win = 2;
  const nums: number[] = [];
  for (let p = Math.max(1, page - win); p <= Math.min(pages, page + win); p++) nums.push(p);

  const base: React.CSSProperties = { minWidth: 34, textAlign: 'center', padding: '6px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' };
  const muted: React.CSSProperties = { ...base, opacity: 0.4, pointerEvents: 'none' };
  const active: React.CSSProperties = { ...base, background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' };

  const Link = ({ p, label, disabled, isActive }: { p: number; label: string; disabled?: boolean; isActive?: boolean }) =>
    disabled ? <span style={muted}>{label}</span>
      : <a href={href(params, p)} style={isActive ? active : base}>{label}</a>;

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}>
      <Link p={1} label="« First" disabled={page === 1} />
      <Link p={page - 1} label="‹ Prev" disabled={page === 1} />
      {nums[0] > 1 && <span className="cell-muted">…</span>}
      {nums.map((p) => <Link key={p} p={p} label={String(p)} isActive={p === page} />)}
      {nums[nums.length - 1] < pages && <span className="cell-muted">…</span>}
      <Link p={page + 1} label="Next ›" disabled={page === pages} />
      <Link p={pages} label="Last »" disabled={page === pages} />
    </div>
  );
}
