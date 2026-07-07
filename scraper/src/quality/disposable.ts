// Loads the committed blocklists once and exposes cheap membership checks.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
function load(file: string): string[] {
  return readFileSync(join(dir, 'data', file), 'utf8')
    .split('\n')
    .map((l) => l.trim().toLowerCase())
    .filter((l) => l && !l.startsWith('#'));
}

const DISPOSABLE = new Set(load('disposable-domains.txt'));
const ROLES = new Set(load('role-accounts.txt'));
const PLACEHOLDER = load('placeholder-emails.txt');
const SHARED_HOSTS = new Set(load('shared-hosts.txt'));

export const isDisposableDomain = (domain: string | null | undefined): boolean =>
  !!domain && DISPOSABLE.has(domain.toLowerCase());

export const isRoleLocalPart = (local: string | null | undefined): boolean =>
  !!local && ROLES.has(local.toLowerCase());

// A shared/social host means the business does NOT own the registrable domain.
export const isSharedHost = (domain: string | null | undefined): boolean =>
  !!domain && SHARED_HOSTS.has(domain.toLowerCase());

// Placeholder / web-dev / asset emails scraped by accident.
export const isPlaceholderEmail = (email: string | null | undefined): boolean => {
  if (!email) return false;
  const e = email.toLowerCase();
  return PLACEHOLDER.some((p) => e.includes(p));
};
