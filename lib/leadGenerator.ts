// Server-side lead generator. Produces realistic sample leads for ANY category
// (built-in or user-created) and a step-by-step run log. Runs inside Vercel's
// free tier (instant, no browser) and inside GitHub Actions (scheduled). Real
// anti-bot scraping would swap in here and write to the same `leads` table.

export type LeadCategory =
  | 'real_estate_buyer'
  | 'real_estate_seller'
  | 'mortgage'
  | 'insurance'
  | 'b2b';

// Default metadata for the 5 built-ins (icons/sources). Custom categories fall
// back to generic sources + a business heuristic derived from their key/label.
export const CATEGORY_META: Record<
  string,
  { label: string; icon: string; blurb: string; sources: string[]; hasCompany: boolean }
> = {
  real_estate_buyer: { label: 'Real Estate Buyers', icon: '🏠', blurb: 'People actively searching to buy property.', sources: ['zillow_directory', 'realtor_com', 'redfin_leads'], hasCompany: false },
  real_estate_seller: { label: 'Real Estate Sellers', icon: '🔑', blurb: 'Homeowners looking to list and sell.', sources: ['fsbo_listings', 'craigslist_housing', 'zillow_fsbo'], hasCompany: false },
  mortgage: { label: 'Mortgage Leads', icon: '🏦', blurb: 'Prospects shopping for home loans & refinancing.', sources: ['lendingtree', 'bankrate_leads', 'nerdwallet'], hasCompany: false },
  insurance: { label: 'Insurance Leads', icon: '🛡️', blurb: 'Consumers comparing insurance quotes.', sources: ['insurance_directory', 'quotewizard', 'policygenius'], hasCompany: false },
  b2b: { label: 'B2B Contacts', icon: '💼', blurb: 'Business decision-makers and company contacts.', sources: ['yellowpages', 'apollo_export', 'linkedin_sales'], hasCompany: true },
};

const FIRST = ['Michael', 'Sarah', 'David', 'Emily', 'Tom', 'Lisa', 'James', 'Maria', 'Robert', 'Jennifer', 'Daniel', 'Ashley', 'Chris', 'Amanda', 'Kevin', 'Nicole', 'Brian', 'Rachel', 'Jason', 'Laura', 'Eric', 'Megan', 'Steven', 'Olivia'];
const LAST = ['Chen', 'Johnson', 'Park', 'Rodriguez', 'Wilson', 'Anderson', 'Smith', 'Garcia', 'Martinez', 'Lee', 'Brown', 'Davis', 'Nguyen', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'White', 'Harris', 'Clark', 'Lewis', 'Walker', 'Hall', 'Young'];
const CITIES = ['San Francisco, CA', 'Austin, TX', 'Seattle, WA', 'Miami, FL', 'Chicago, IL', 'Denver, CO', 'Phoenix, AZ', 'Portland, OR', 'Atlanta, GA', 'Boston, MA', 'Nashville, TN', 'San Diego, CA', 'Dallas, TX', 'Charlotte, NC'];
const COMPANIES = ['Acme Corp', 'TechStart', 'BrightPath', 'NovaWorks', 'Summit Group', 'BlueRiver', 'Ironclad LLC', 'Vertex Labs', 'Cobalt Inc', 'Meridian Co', 'Pinnacle', 'Northwind'];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function chance(p: number): boolean { return Math.random() < p; }
function phone(): string {
  const a = 200 + Math.floor(Math.random() * 700);
  const b = 100 + Math.floor(Math.random() * 900);
  const c = 1000 + Math.floor(Math.random() * 9000);
  return `+1-${a}-${b}-${c}`;
}
function slug(s: string): string { return s.toLowerCase().replace(/[^a-z0-9]+/g, ''); }

export type CategoryInfo = { key: string; label: string; icon?: string };

// Resolve metadata for any category (built-in or custom).
export function resolveMeta(cat: CategoryInfo) {
  const builtin = CATEGORY_META[cat.key];
  if (builtin) return builtin;
  const businessy = /b2b|business|company|agency|saas|startup|vendor|supplier|wholesale/i.test(cat.key + ' ' + cat.label);
  return {
    label: cat.label,
    icon: cat.icon || '📋',
    blurb: '',
    sources: ['web_directory', 'public_listing', 'aggregator_export'],
    hasCompany: businessy,
  };
}

export type GeneratedLead = {
  category: string;
  name: string;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  website: string | null;
  company: string | null;
  location: string;
  source: string;
  status: string;
};

// Generate leads with a realistic mix of contact types (not every lead has all).
export function generateLeads(cat: CategoryInfo, count: number): GeneratedLead[] {
  const meta = resolveMeta(cat);
  const leads: GeneratedLead[] = [];
  for (let i = 0; i < count; i++) {
    const first = pick(FIRST);
    const last = pick(LAST);
    const company = meta.hasCompany ? pick(COMPANIES) : null;
    const emailDomain = pick(['gmail.com', 'outlook.com', 'yahoo.com', 'icloud.com']);
    const compSlug = company ? slug(company) : null;

    const hasEmail = chance(0.9);
    const hasPhone = chance(0.7);
    const hasLinkedIn = chance(meta.hasCompany ? 0.75 : 0.45);
    const hasWebsite = company ? chance(0.8) : chance(0.15);
    // Guarantee at least one contact method.
    let email = hasEmail
      ? (company ? `${first[0].toLowerCase()}${last.toLowerCase()}@${compSlug}.com` : `${first.toLowerCase()}.${last.toLowerCase()}${Math.floor(Math.random() * 90)}@${emailDomain}`)
      : null;
    const phoneVal = hasPhone ? phone() : null;
    const linkedin = hasLinkedIn ? `https://linkedin.com/in/${first.toLowerCase()}-${last.toLowerCase()}-${Math.floor(1000 + Math.random() * 9000)}` : null;
    const website = hasWebsite ? (compSlug ? `https://${compSlug}.com` : `https://${first.toLowerCase()}${last.toLowerCase()}.io`) : null;
    if (!email && !phoneVal && !linkedin) email = `${first.toLowerCase()}.${last.toLowerCase()}@${emailDomain}`;

    leads.push({
      category: cat.key,
      name: `${first} ${last}`,
      email,
      phone: phoneVal,
      linkedin_url: linkedin,
      website,
      company,
      location: pick(CITIES),
      source: pick(meta.sources),
      status: 'new',
    });
  }
  return leads;
}

export type LogLine = { ts: string; level: 'info' | 'success' | 'warn'; message: string };

export function buildRunLog(cat: CategoryInfo, source: string, fetched: number, inserted: number, briefsAI: number, ms: number): LogLine[] {
  const now = Date.now();
  const t = (offset: number) => new Date(now - ms + offset).toISOString();
  const meta = resolveMeta(cat);
  return [
    { ts: t(0), level: 'info', message: `Starting lead-generation run · category="${cat.key}"` },
    { ts: t(Math.round(ms * 0.12)), level: 'info', message: `Connecting to source: ${source}` },
    { ts: t(Math.round(ms * 0.3)), level: 'info', message: `Fetched ${fetched} candidate records from ${meta.label}` },
    { ts: t(Math.round(ms * 0.45)), level: 'info', message: `Extracting contacts (email / phone / LinkedIn / website)` },
    { ts: t(Math.round(ms * 0.6)), level: 'warn', message: `${fetched - inserted} record(s) skipped (duplicate or missing contact)` },
    { ts: t(Math.round(ms * 0.75)), level: 'info', message: `Writing lead briefs · ${briefsAI}/${inserted} via AI, ${inserted - briefsAI} via template` },
    { ts: t(Math.round(ms * 0.92)), level: 'success', message: `Inserted ${inserted} new lead(s) into database` },
    { ts: t(ms), level: 'success', message: `Run complete in ${ms} ms` },
  ];
}
