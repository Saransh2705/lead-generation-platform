// Reuse the app's brief writer (Groq AI + template fallback) on scraped leads.
import { writeBriefs } from '../../../lib/brief';
import type { UpsertPayload } from '../quality/types';

export async function attachBriefs(payloads: UpsertPayload[], category: { key: string; label: string }) {
  if (!payloads.length) return;
  // writeBriefs reads name/company/location/source/contacts and sets `.brief` on each.
  await writeBriefs(payloads as any, category, { budgetMs: 40000, perCallMs: 6000 });
  for (const p of payloads) p.brief = (p as any).brief ?? null;
}
