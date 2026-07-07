// Shared types for the quality pipeline: raw scrape output → normalized →
// verified → scored → upsert payload for the DB `upsert_lead` RPC.

export type RawCandidate = {
  category: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  linkedin_url?: string | null;
  company?: string | null;
  location?: string | null;   // "City, ST" if known
  country?: string | null;
  state?: string | null;
  city?: string | null;
  geo?: string | null;        // the search geo string, e.g. "Austin, TX"
  lat?: number | null;
  lng?: number | null;
  source_key: string;         // discovery source that produced this
  source_url?: string | null;
  socials?: Record<string, string>;  // { linkedin, facebook, instagram, twitter, github, ... }
  logo_url?: string | null;   // company logo, if the site exposes one
  description?: string | null; // heavy company detail, if available
  raw?: unknown;
};

export type EmailStatus =
  | 'unverified' | 'invalid_syntax' | 'no_mx' | 'disposable' | 'role' | 'ok' | 'unknown';
export type PhoneStatus = 'unverified' | 'invalid' | 'valid';

// The object passed (as JSON) to the Postgres `upsert_lead(p jsonb)` RPC.
export type UpsertPayload = {
  category: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  socials: Record<string, string>;
  website: string | null;
  company: string | null;
  location: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  source: string;
  source_key: string;
  source_url: string | null;
  brief?: string | null;
  logo_url: string | null;
  description: string | null;
  status: string;
  mode: 'scraped';
  scrape_env: 'cloud' | 'home' | 'manual';
  scrape_job_id?: number | null;
  name_norm: string | null;
  email_norm: string | null;
  email_domain: string | null;
  website_domain: string | null;
  city_norm: string | null;
  geocell: string | null;
  phone_e164: string | null;
  phone_line_type: string | null;
  entity_key: string;
  name_source_trust: number;
  email_status: EmailStatus | null;
  mx_found: boolean | null;
  is_disposable: boolean | null;
  is_role_account: boolean | null;
  phone_status: PhoneStatus | null;
  confidence: number;
  is_spam_risk: boolean;
  enriched_at: string | null;
  verified_at: string | null;
};
