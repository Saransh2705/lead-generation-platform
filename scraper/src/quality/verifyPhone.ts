// FREE phone validation via libphonenumber-js (offline). Normalizes to E.164 +
// line type. Flags when we had to guess the country (no +CC in the number) so
// the confidence score can cap it.
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import type { PhoneStatus } from './types';

function regionFromGeo(geo?: string | null): { region: CountryCode; guessed: boolean } {
  const g = (geo || '').toLowerCase();
  if (/\b(uk|united kingdom|england|scotland|wales|london)\b/.test(g)) return { region: 'GB', guessed: false };
  if (/\b(canada|ontario|quebec|toronto|vancouver|,\s*on|,\s*bc|,\s*qc)\b/.test(g)) return { region: 'CA', guessed: false };
  if (/\b(australia|sydney|melbourne|brisbane)\b/.test(g)) return { region: 'AU', guessed: false };
  if (/\b(india|mumbai|delhi|bangalore|bengaluru)\b/.test(g)) return { region: 'IN', guessed: false };
  return { region: 'US', guessed: true };
}

export type PhoneVerdict = {
  phone_status: PhoneStatus;
  phone_e164: string | null;
  phone_line_type: string | null;
  country_defaulted: boolean;
};

export function verifyPhone(phone?: string | null, geo?: string | null): PhoneVerdict {
  if (!phone || !phone.trim()) return { phone_status: 'unverified', phone_e164: null, phone_line_type: null, country_defaulted: false };
  const explicitCC = phone.trim().startsWith('+');
  const { region, guessed } = regionFromGeo(geo);
  const p = parsePhoneNumberFromString(phone, region);
  const country_defaulted = guessed && !explicitCC;
  if (!p || !p.isValid()) return { phone_status: 'invalid', phone_e164: null, phone_line_type: null, country_defaulted };
  return {
    phone_status: 'valid',
    phone_e164: p.number,
    phone_line_type: (p.getType() || 'unknown').toLowerCase(),
    country_defaulted,
  };
}
