'use client';

import { useEffect, useState } from 'react';

/**
 * Renders a timestamp in the VIEWER's local timezone.
 * Server render + first client render both show the raw ISO (matching markup,
 * so no hydration warning); after mount it upgrades to a friendly local string.
 */
export default function LocalTime({ iso }: { iso: string | null }) {
  const [pretty, setPretty] = useState('');

  useEffect(() => {
    if (!iso) return;
    setPretty(
      new Date(iso).toLocaleString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    );
  }, [iso]);

  if (!iso) return <span className="cell-muted">—</span>;
  const fallback = iso.slice(0, 16).replace('T', ' ');
  return <span suppressHydrationWarning title={iso}>{pretty || fallback}</span>;
}
