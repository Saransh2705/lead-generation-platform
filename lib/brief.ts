// Lead brief generator: a short "who is this / why they're a lead" line per lead.
// aiBrief() uses Groq (free, llama-3.1-8b-instant); templateBrief() is the instant
// deterministic fallback so a run never stalls if the API is rate-limited/cold.

import { GeneratedLead, resolveMeta, CategoryInfo } from './leadGenerator';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';

function contactSummary(l: GeneratedLead): string {
  const parts: string[] = [];
  if (l.email) parts.push('email');
  if (l.phone) parts.push('phone');
  if (l.linkedin_url) parts.push('LinkedIn');
  if (l.website) parts.push('website');
  return parts.join(', ') || 'no direct contact';
}

// Deterministic 1–2 sentence brief built from the lead's data (no network).
export function templateBrief(l: GeneratedLead, cat: CategoryInfo): string {
  const meta = resolveMeta(cat);
  const loc = l.location || 'an unspecified area';
  const who = l.company ? `${l.name} at ${l.company}` : l.name;
  const base: Record<string, string> = {
    real_estate_buyer: `${who} is an active property buyer in ${loc}, sourced via ${l.source}.`,
    real_estate_seller: `${who} is a homeowner in ${loc} looking to list and sell, found via ${l.source}.`,
    mortgage: `${who} is shopping for a home loan or refinance in ${loc}, captured from ${l.source}.`,
    insurance: `${who} is comparing insurance quotes in ${loc}, sourced from ${l.source}.`,
    b2b: `${who} is a business contact in ${loc}, exported from ${l.source}.`,
  };
  const lead = base[cat.key] || `${who} is a ${meta.label.toLowerCase()} lead in ${loc}, sourced via ${l.source}.`;
  return `${lead} Reachable by ${contactSummary(l)}.`;
}

// AI brief via Groq. Returns null on any error/timeout so the caller can fall back.
export async function aiBrief(l: GeneratedLead, cat: CategoryInfo, timeoutMs = 8000): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  const meta = resolveMeta(cat);
  const facts = [
    `Category: ${meta.label}`,
    `Name: ${l.name}`,
    l.company ? `Company: ${l.company}` : '',
    l.location ? `Location: ${l.location}` : '',
    `Source: ${l.source}`,
    `Contacts available: ${contactSummary(l)}`,
  ].filter(Boolean).join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.7,
        max_tokens: 90,
        messages: [
          { role: 'system', content: 'You write ultra-concise sales-lead briefs. One or two sentences, under 40 words. Describe who the person likely is and why they are a promising lead. No preamble, no quotes, plain text.' },
          { role: 'user', content: `Write a short lead brief from these facts:\n${facts}` },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text ? text.replace(/^["']|["']$/g, '') : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Write briefs for a batch: try AI concurrently within an overall time budget,
// fall back to template per-lead. Returns count written via AI (for the run log).
export async function writeBriefs(
  leads: GeneratedLead[],
  cat: CategoryInfo,
  opts: { budgetMs?: number; perCallMs?: number } = {}
): Promise<number> {
  const deadline = Date.now() + (opts.budgetMs ?? 60000);
  let aiCount = 0;
  await Promise.all(
    leads.map(async (l) => {
      const remaining = deadline - Date.now();
      let brief: string | null = null;
      if (remaining > 400) {
        brief = await aiBrief(l, cat, Math.min(opts.perCallMs ?? 8000, remaining));
      }
      if (brief) { aiCount++; (l as any).brief = brief; }
      else (l as any).brief = templateBrief(l, cat);
    })
  );
  return aiCount;
}
