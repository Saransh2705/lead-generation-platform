// FREE email verification: syntax + disposable + role + MX (DNS only, no port 25,
// no SMTP — those are unreliable and blocked on GitHub Actions). Never asserts
// "deliverable"; returns a status the confidence score consumes.
import { promises as dns } from 'node:dns';
import { emailParts } from './normalize';
import { isDisposableDomain, isRoleLocalPart } from './disposable';
import type { EmailStatus } from './types';

const mxCache = new Map<string, boolean | null>();

async function hasMx(domain: string, timeoutMs = 5000): Promise<boolean | null> {
  if (mxCache.has(domain)) return mxCache.get(domain)!;
  try {
    const res = await Promise.race([
      dns.resolveMx(domain),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs)),
    ]);
    const ok = Array.isArray(res) && res.length > 0;
    mxCache.set(domain, ok);
    return ok;
  } catch (e: any) {
    if (e?.code === 'ENOTFOUND' || e?.code === 'ENODATA') { mxCache.set(domain, false); return false; }
    return null; // timeout / transient → unknown (do NOT cache)
  }
}

export type EmailVerdict = {
  email_status: EmailStatus;
  mx_found: boolean | null;
  is_disposable: boolean;
  is_role_account: boolean;
  email_domain: string | null;
};

export async function verifyEmail(email?: string | null): Promise<EmailVerdict> {
  const { local, domain } = emailParts(email);
  if (!local || !domain) {
    return { email_status: email ? 'invalid_syntax' : 'unverified', mx_found: null, is_disposable: false, is_role_account: false, email_domain: domain };
  }
  const is_disposable = isDisposableDomain(domain);
  const is_role_account = isRoleLocalPart(local);
  if (is_disposable) return { email_status: 'disposable', mx_found: null, is_disposable, is_role_account, email_domain: domain };
  const mx = await hasMx(domain);
  let email_status: EmailStatus;
  if (mx === false) email_status = 'no_mx';
  else if (mx === null) email_status = 'unknown';
  else email_status = is_role_account ? 'role' : 'ok';
  return { email_status, mx_found: mx, is_disposable, is_role_account, email_domain: domain };
}
