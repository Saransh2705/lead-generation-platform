// Server-side lead generator. Produces realistic sample leads per category and a
// step-by-step run log. This is a DEMO generator that runs inside Vercel's free
// tier (instant, no browser). Real anti-bot scraping would run in GitHub Actions
// and write to the same `leads` table — this proves the end-to-end path.

export type LeadCategory =
  | 'real_estate_buyer'
  | 'real_estate_seller'
  | 'mortgage'
  | 'insurance'
  | 'b2b';

export const CATEGORY_META: Record<
  LeadCategory,
  { label: string; icon: string; blurb: string; sources: string[]; hasCompany: boolean }
> = {
  real_estate_buyer: {
    label: 'Real Estate Buyers',
    icon: '🏠',
    blurb: 'People actively searching to buy property.',
    sources: ['zillow_directory', 'realtor_com', 'redfin_leads'],
    hasCompany: false,
  },
  real_estate_seller: {
    label: 'Real Estate Sellers',
    icon: '🔑',
    blurb: 'Homeowners looking to list and sell.',
    sources: ['fsbo_listings', 'craigslist_housing', 'zillow_fsbo'],
    hasCompany: false,
  },
  mortgage: {
    label: 'Mortgage Leads',
    icon: '🏦',
    blurb: 'Prospects shopping for home loans & refinancing.',
    sources: ['lendingtree', 'bankrate_leads', 'nerdwallet'],
    hasCompany: false,
  },
  insurance: {
    label: 'Insurance Leads',
    icon: '🛡️',
    blurb: 'Consumers comparing insurance quotes.',
    sources: ['insurance_directory', 'quotewizard', 'policygenius'],
    hasCompany: false,
  },
  b2b: {
    label: 'B2B Contacts',
    icon: '💼',
    blurb: 'Business decision-makers and company contacts.',
    sources: ['yellowpages', 'apollo_export', 'linkedin_sales'],
    hasCompany: true,
  },
};

const FIRST = ['Michael', 'Sarah', 'David', 'Emily', 'Tom', 'Lisa', 'James', 'Maria', 'Robert', 'Jennifer', 'Daniel', 'Ashley', 'Chris', 'Amanda', 'Kevin', 'Nicole', 'Brian', 'Rachel', 'Jason', 'Laura', 'Eric', 'Megan', 'Steven', 'Olivia'];
const LAST = ['Chen', 'Johnson', 'Park', 'Rodriguez', 'Wilson', 'Anderson', 'Smith', 'Garcia', 'Martinez', 'Lee', 'Brown', 'Davis', 'Nguyen', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'White', 'Harris', 'Clark', 'Lewis', 'Walker', 'Hall', 'Young'];
const CITIES = ['San Francisco, CA', 'Austin, TX', 'Seattle, WA', 'Miami, FL', 'Chicago, IL', 'Denver, CO', 'Phoenix, AZ', 'Portland, OR', 'Atlanta, GA', 'Boston, MA', 'Nashville, TN', 'San Diego, CA', 'Dallas, TX', 'Charlotte, NC'];
const COMPANIES = ['Acme Corp', 'TechStart', 'BrightPath', 'NovaWorks', 'Summit Group', 'BlueRiver', 'Ironclad LLC', 'Vertex Labs', 'Cobalt Inc', 'Meridian Co', 'Pinnacle', 'Northwind'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function phone(): string {
  const a = 200 + Math.floor(Math.random() * 700);
  const b = 100 + Math.floor(Math.random() * 900);
  const c = 1000 + Math.floor(Math.random() * 9000);
  return `+1-${a}-${b}-${c}`;
}

export type GeneratedLead = {
  category: LeadCategory;
  name: string;
  email: string;
  phone: string;
  company: string | null;
  location: string;
  source: string;
  status: string;
};

export function generateLeads(category: LeadCategory, count: number): GeneratedLead[] {
  const meta = CATEGORY_META[category];
  const leads: GeneratedLead[] = [];
  for (let i = 0; i < count; i++) {
    const first = pick(FIRST);
    const last = pick(LAST);
    const domain = pick(['gmail.com', 'outlook.com', 'yahoo.com', 'icloud.com']);
    const company = meta.hasCompany ? pick(COMPANIES) : null;
    const email = meta.hasCompany
      ? `${first[0].toLowerCase()}${last.toLowerCase()}@${company!.toLowerCase().replace(/[^a-z]/g, '')}.com`
      : `${first.toLowerCase()}.${last.toLowerCase()}${Math.floor(Math.random() * 90)}@${domain}`;
    leads.push({
      category,
      name: `${first} ${last}`,
      email,
      phone: phone(),
      company,
      location: pick(CITIES),
      source: pick(meta.sources),
      status: 'new',
    });
  }
  return leads;
}

export type LogLine = { ts: string; level: 'info' | 'success' | 'warn'; message: string };

export function buildRunLog(category: LeadCategory, source: string, fetched: number, inserted: number, ms: number): LogLine[] {
  const now = Date.now();
  const t = (offset: number) => new Date(now - ms + offset).toISOString();
  const meta = CATEGORY_META[category];
  return [
    { ts: t(0), level: 'info', message: `Starting lead-generation run · category="${category}"` },
    { ts: t(Math.round(ms * 0.15)), level: 'info', message: `Connecting to source: ${source}` },
    { ts: t(Math.round(ms * 0.35)), level: 'info', message: `Fetched ${fetched} candidate records from ${meta.label}` },
    { ts: t(Math.round(ms * 0.55)), level: 'info', message: `Parsing & validating contact fields (email / phone required)` },
    { ts: t(Math.round(ms * 0.7)), level: 'warn', message: `${fetched - inserted} record(s) skipped (duplicate or missing contact)` },
    { ts: t(Math.round(ms * 0.9)), level: 'success', message: `Inserted ${inserted} new lead(s) into database` },
    { ts: t(ms), level: 'success', message: `Run complete in ${ms} ms` },
  ];
}
