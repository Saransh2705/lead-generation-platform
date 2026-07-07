'use client';

import { useEffect, useRef, useState } from 'react';

type S = 'idle' | 'starting' | 'pending' | 'dispatched' | 'running' | 'completed' | 'blocked' | 'failed' | 'error';
const LABEL: Record<S, string> = {
  idle: '▶ Run', starting: 'Starting…', pending: 'Queued…', dispatched: 'Launching…',
  running: 'Scraping…', completed: '✓ Done', blocked: 'Blocked', failed: 'Failed', error: 'Error',
};

// Fires a real cloud scrape for a category, then polls its status inline.
export default function RunButton({ categoryKey }: { categoryKey: string }) {
  const [state, setState] = useState<S>('idle');
  const [msg, setMsg] = useState('');
  const timer = useRef<any>(null);
  useEffect(() => () => clearInterval(timer.current), []);

  async function run() {
    setState('starting'); setMsg('');
    try {
      const r = await fetch('/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: categoryKey }) });
      const d = await r.json();
      if (!r.ok) { setState('error'); setMsg(d.error || 'failed to start'); return; }
      setState('pending');
      timer.current = setInterval(async () => {
        const s = await fetch(`/api/run-status?schedule=${d.schedule_id}`).then((x) => x.json()).catch(() => ({ status: 'pending' }));
        const st: string = s.status;
        if (st === 'completed') { setState('completed'); setMsg(`+${s.inserted_count || 0} new · ${s.updated_count || 0} merged`); clearInterval(timer.current); }
        else if (st === 'blocked') { setState('blocked'); setMsg('source blocked (datacenter IP) — try again'); clearInterval(timer.current); }
        else if (st === 'failed' || st === 'stuck') { setState('failed'); setMsg(s.error || 'run failed'); clearInterval(timer.current); }
        else setState(st === 'running' ? 'running' : st === 'dispatched' ? 'dispatched' : 'pending');
      }, 5000);
    } catch (e: any) { setState('error'); setMsg(e?.message || 'error'); }
  }

  const busy = ['starting', 'pending', 'dispatched', 'running'].includes(state);
  const color = state === 'completed' ? 'var(--green)' : ['blocked', 'failed', 'error'].includes(state) ? 'var(--red)' : 'var(--muted)';
  return (
    <div>
      <button type="button" onClick={run} disabled={busy} style={{ width: '100%' }}>{LABEL[state]}</button>
      {msg && <div style={{ fontSize: 12, marginTop: 6, color, fontWeight: 500 }}>{msg}</div>}
      {busy && state !== 'starting' && <div style={{ fontSize: 11.5, marginTop: 4, color: 'var(--muted-soft)' }}>running in the cloud — a few minutes…</div>}
    </div>
  );
}
