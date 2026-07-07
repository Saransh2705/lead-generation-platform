// Classify an outbound link as a social/contact profile. Skips share/intent
// buttons and bare-domain links (we want the business's own profile URL).
const HOSTS: Record<string, string> = {
  'linkedin.com': 'linkedin',
  'facebook.com': 'facebook',
  'fb.com': 'facebook',
  'instagram.com': 'instagram',
  'twitter.com': 'twitter',
  'x.com': 'twitter',
  'github.com': 'github',
  'youtube.com': 'youtube',
  'youtu.be': 'youtube',
  'tiktok.com': 'tiktok',
  'wa.me': 'whatsapp',
  'whatsapp.com': 'whatsapp',
  't.me': 'telegram',
  'telegram.me': 'telegram',
  'pinterest.com': 'pinterest',
  'yelp.com': 'yelp',
  'threads.net': 'threads',
  'reddit.com': 'reddit',
};

// share/intent endpoints and bare share params are NOT a profile
const SKIP = /\/(sharer|share|intent|dialog|plugins|tr)\b|[?&](u|url|text|quote)=/i;

export function classifyLink(href: string): { platform: string; url: string } | null {
  let u: URL;
  try { u = new URL(href); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  for (const [h, platform] of Object.entries(HOSTS)) {
    if (host === h || host.endsWith('.' + h)) {
      if (SKIP.test(href)) return null;
      // require a path (an actual profile), except whatsapp/telegram deep links
      if (u.pathname.replace(/\/+$/, '').length < 1 && !['whatsapp', 'telegram'].includes(platform)) return null;
      return { platform, url: (u.origin + u.pathname).replace(/\/+$/, '') };
    }
  }
  return null;
}

// Merge classified links into a socials map, keeping the FIRST seen per platform.
export function collectSocials(hrefs: string[], into: Record<string, string> = {}): Record<string, string> {
  for (const href of hrefs) {
    const c = classifyLink(href);
    if (c && !into[c.platform]) into[c.platform] = c.url;
  }
  return into;
}
