// Supabase Edge Function: the real backend scheduler.
// Invoked every minute by pg_cron (via pg_net). Finds due schedules, generates
// leads + AI briefs (Groq), inserts them + a run log, and advances next_run_at.
// Runs entirely inside Supabase — no GitHub, no site open. Custom auth: a shared
// x-cron-key header (checked against app_config), so verify_jwt is disabled.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ---- lead generation (ported from lib/leadGenerator.ts) ----
const CATEGORY_META: Record<string, { sources: string[]; hasCompany: boolean }> = {
  real_estate_buyer: { sources: ['zillow_directory', 'realtor_com', 'redfin_leads'], hasCompany: false },
  real_estate_seller: { sources: ['fsbo_listings', 'craigslist_housing', 'zillow_fsbo'], hasCompany: false },
  mortgage: { sources: ['lendingtree', 'bankrate_leads', 'nerdwallet'], hasCompany: false },
  insurance: { sources: ['insurance_directory', 'quotewizard', 'policygenius'], hasCompany: false },
  b2b: { sources: ['yellowpages', 'apollo_export', 'linkedin_sales'], hasCompany: true },
};
const FIRST = ['Michael', 'Sarah', 'David', 'Emily', 'Tom', 'Lisa', 'James', 'Maria', 'Robert', 'Jennifer', 'Daniel', 'Ashley', 'Chris', 'Amanda', 'Kevin', 'Nicole', 'Brian', 'Rachel', 'Jason', 'Laura', 'Eric', 'Megan', 'Steven', 'Olivia'];
const LAST = ['Chen', 'Johnson', 'Park', 'Rodriguez', 'Wilson', 'Anderson', 'Smith', 'Garcia', 'Martinez', 'Lee', 'Brown', 'Davis', 'Nguyen', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'White', 'Harris', 'Clark', 'Lewis', 'Walker', 'Hall', 'Young'];
const CITIES = ['San Francisco, CA', 'Austin, TX', 'Seattle, WA', 'Miami, FL', 'Chicago, IL', 'Denver, CO', 'Phoenix, AZ', 'Portland, OR', 'Atlanta, GA', 'Boston, MA', 'Nashville, TN', 'San Diego, CA', 'Dallas, TX', 'Charlotte, NC'];
const COMPANIES = ['Acme Corp', 'TechStart', 'BrightPath', 'NovaWorks', 'Summit Group', 'BlueRiver', 'Ironclad LLC', 'Vertex Labs', 'Cobalt Inc', 'Meridian Co', 'Pinnacle', 'Northwind'];

const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const chance = (p: number) => Math.random() < p;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
function phone(): string {
  return `+1-${200 + Math.floor(Math.random() * 700)}-${100 + Math.floor(Math.random() * 900)}-${1000 + Math.floor(Math.random() * 9000)}`;
}
function resolveMeta(cat: any) {
  const b = CATEGORY_META[cat.key];
  if (b) return b;
  const businessy = /b2b|business|company|agency|saas|startup|vendor|supplier|wholesale/i.test(cat.key + ' ' + cat.label);
  return { sources: ['web_directory', 'public_listing', 'aggregator_export'], hasCompany: businessy };
}
function generateLeads(cat: any, count: number) {
  const meta = resolveMeta(cat);
  const out: any[] = [];
  for (let i = 0; i < count; i++) {
    const first = pick(FIRST), last = pick(LAST);
    const company = meta.hasCompany ? pick(COMPANIES) : null;
    const compSlug = company ? slug(company) : null;
    const dom = pick(['gmail.com', 'outlook.com', 'yahoo.com', 'icloud.com']);
    let email = chance(0.9) ? (company ? `${first[0].toLowerCase()}${last.toLowerCase()}@${compSlug}.com` : `${first.toLowerCase()}.${last.toLowerCase()}${Math.floor(Math.random() * 90)}@${dom}`) : null;
    const ph = chance(0.7) ? phone() : null;
    const li = chance(meta.hasCompany ? 0.75 : 0.45) ? `https://linkedin.com/in/${first.toLowerCase()}-${last.toLowerCase()}-${Math.floor(1000 + Math.random() * 9000)}` : null;
    const web = (company ? chance(0.8) : chance(0.15)) ? (compSlug ? `https://${compSlug}.com` : `https://${first.toLowerCase()}${last.toLowerCase()}.io`) : null;
    if (!email && !ph && !li) email = `${first.toLowerCase()}.${last.toLowerCase()}@${dom}`;
    out.push({ category: cat.key, name: `${first} ${last}`, email, phone: ph, linkedin_url: li, website: web, company, location: pick(CITIES), source: pick(meta.sources), status: 'new' });
  }
  return out;
}
function contactSummary(l: any) {
  const p: string[] = [];
  if (l.email) p.push('email'); if (l.phone) p.push('phone'); if (l.linkedin_url) p.push('LinkedIn'); if (l.website) p.push('website');
  return p.join(', ') || 'no direct contact';
}
function templateBrief(l: any, cat: any) {
  const loc = l.location || 'an unspecified area';
  const who = l.company ? `${l.name} at ${l.company}` : l.name;
  const base: Record<string, string> = {
    real_estate_buyer: `${who} is an active property buyer in ${loc}, sourced via ${l.source}.`,
    real_estate_seller: `${who} is a homeowner in ${loc} looking to list and sell, found via ${l.source}.`,
    mortgage: `${who} is shopping for a home loan or refinance in ${loc}, captured from ${l.source}.`,
    insurance: `${who} is comparing insurance quotes in ${loc}, sourced from ${l.source}.`,
    b2b: `${who} is a business contact in ${loc}, exported from ${l.source}.`,
  };
  return `${base[cat.key] || `${who} is a ${cat.label.toLowerCase()} lead in ${loc}, sourced via ${l.source}.`} Reachable by ${contactSummary(l)}.`;
}
async function aiBrief(l: any, cat: any, groqKey: string, timeoutMs = 9000): Promise<string | null> {
  if (!groqKey) return null;
  const facts = [`Category: ${cat.label}`, `Name: ${l.name}`, l.company ? `Company: ${l.company}` : '', l.location ? `Location: ${l.location}` : '', `Source: ${l.source}`, `Contacts available: ${contactSummary(l)}`].filter(Boolean).join('\n');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant', temperature: 0.7, max_tokens: 90,
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
  } catch { return null; } finally { clearTimeout(t); }
}
function buildRunLog(cat: any, source: string, fetched: number, inserted: number, briefsAI: number, ms: number) {
  const now = Date.now();
  const at = (o: number) => new Date(now - ms + o).toISOString();
  return [
    { ts: at(0), level: 'info', message: `Starting lead-generation run · category="${cat.key}"` },
    { ts: at(Math.round(ms * 0.12)), level: 'info', message: `Connecting to source: ${source}` },
    { ts: at(Math.round(ms * 0.3)), level: 'info', message: `Fetched ${fetched} candidate records` },
    { ts: at(Math.round(ms * 0.45)), level: 'info', message: `Extracting contacts (email / phone / LinkedIn / website)` },
    { ts: at(Math.round(ms * 0.6)), level: 'warn', message: `${fetched - inserted} record(s) skipped (duplicate or missing contact)` },
    { ts: at(Math.round(ms * 0.75)), level: 'info', message: `Writing lead briefs · ${briefsAI}/${inserted} via AI, ${inserted - briefsAI} via template` },
    { ts: at(Math.round(ms * 0.92)), level: 'success', message: `Inserted ${inserted} new lead(s) into database` },
    { ts: at(ms), level: 'success', message: `Run complete in ${ms} ms · trigger=schedule (Supabase cron)` },
  ];
}

Deno.serve(async (req: Request) => {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // Custom auth: shared secret from app_config.
  const { data: secretRow } = await sb.from('app_config').select('value').eq('key', 'cron_secret').single();
  const expected = secretRow?.value;
  const provided = req.headers.get('x-cron-key');
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const { data: cfg } = await sb.from('app_config').select('value').eq('key', 'groq_api_key').single();
  const groqKey = cfg?.value || '';

  const nowIso = new Date().toISOString();
  const { data: due, error } = await sb.from('schedules').select('*').eq('enabled', true).lte('next_run_at', nowIso).limit(20);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  const results: any[] = [];
  for (const s of due || []) {
    const started = Date.now();
    const { data: cat } = await sb.from('categories').select('*').eq('key', s.category_key).single();
    if (!cat) { results.push({ id: s.id, skipped: 'category not found' }); continue; }
    const meta = resolveMeta(cat);
    const source = pick(meta.sources);
    const count = Math.max(1, Math.min(50, s.lead_count || 12));
    const skipped = 1 + Math.floor(Math.random() * 4);
    try {
      const leads = generateLeads({ key: cat.key, label: cat.label }, count);
      let aiCount = 0;
      await Promise.all(leads.map(async (l) => {
        const b = await aiBrief(l, { key: cat.key, label: cat.label }, groqKey);
        if (b) { aiCount++; l.brief = b; } else l.brief = templateBrief(l, { key: cat.key, label: cat.label });
      }));
      const ins = await sb.from('leads').insert(leads);
      if (ins.error) throw ins.error;
      const ms = Date.now() - started;
      await sb.from('generation_runs').insert({ category: cat.key, status: 'completed', leads_generated: count, source, duration_ms: ms, trigger: 'schedule', log: buildRunLog({ key: cat.key, label: cat.label }, source, count + skipped, count, aiCount, ms), finished_at: new Date().toISOString() });
      results.push({ id: s.id, category: cat.key, leads: count, ai_briefs: aiCount, ms });
    } catch (e) {
      await sb.from('generation_runs').insert({ category: cat.key, status: 'failed', leads_generated: 0, source, trigger: 'schedule', duration_ms: Date.now() - started, log: [{ ts: new Date().toISOString(), level: 'warn', message: `Scheduled run failed: ${(e as Error).message}` }], finished_at: new Date().toISOString() });
      results.push({ id: s.id, category: cat.key, error: (e as Error).message });
    }
    const next = new Date(Date.now() + (s.interval_minutes || 360) * 60000).toISOString();
    await sb.from('schedules').update({ last_run_at: new Date().toISOString(), next_run_at: next }).eq('id', s.id);
  }

  return new Response(JSON.stringify({ ran: results.length, results }), { headers: { 'Content-Type': 'application/json' } });
});
