// Client-side confidence suggestion (0..100). The DB `signal_ceiling` clamps this
// so a buggy/forged high score can never exceed what the signals justify.
import type { EmailStatus, PhoneStatus } from './types';

const EMAIL_PTS: Record<EmailStatus, number> = {
  ok: 70, role: 45, unknown: 40, unverified: 35, disposable: 10, no_mx: 10, invalid_syntax: 5,
};

export function computeConfidence(a: {
  email_status: EmailStatus | null;
  mx_found: boolean | null;
  phone_status: PhoneStatus | null;
  has_website: boolean;
  has_name: boolean;
  is_disposable: boolean;
  is_role_account: boolean;
  is_placeholder: boolean;
  phone_country_defaulted: boolean;
}): { confidence: number; is_spam_risk: boolean } {
  let c = 0;
  if (a.email_status) c += EMAIL_PTS[a.email_status] ?? 0;
  if (a.email_status === 'ok' && a.mx_found) c += 10;
  if (a.phone_status === 'valid') c += a.phone_country_defaulted ? 8 : 18;
  if (a.has_website) c += 6;
  if (a.has_name) c += 4;
  c = Math.max(0, Math.min(100, c));
  const is_spam_risk =
    a.is_disposable ||
    a.is_placeholder ||
    (a.is_role_account && a.phone_status !== 'valid' && a.email_status !== 'ok');
  return { confidence: Math.round(c), is_spam_risk };
}
