// Search-driven discovery: query a scrape-tolerant search engine (DuckDuckGo,
// with Bing as fallback) for "{business type} in {place}", harvest the organic
// result websites, and hand them to the shared enrichment step (email/phone/
// logo/description). No browser needed for the search itself — just an HTTP fetch,
// which is why it survives datacenter IPs where Google/Yelp hard-block.
import type { RawCandidate } from '../quality/types';
import type { SourceOpts, SourceResult } from './yellowPages';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
// Aggregators / socials / portals that aren't a single business site.
const SKIP = /(^|\.)(google|bing|duckduckgo|youtube|facebook|fb|instagram|linkedin|twitter|x|tiktok|pinterest|wikipedia|tripadvisor|yelp|justdial|indeed|naukri|glassdoor|quora|reddit|medium|blogspot|wordpress|amazon|booking|expedia|makemytrip)\./i;

function titleToName(title: string, host: string): string {
  const clean = title.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").trim();
  const first = clean.split(/\s[|\-–—:•]\s/)[0].trim();
  return first && first.length > 1 ? first : host.replace(/\.[a-z.]+$/, '');
}

// DuckDuckGo HTML endpoint — links are wrapped as /l/?uddg=<encoded-target>.
function parseDuckDuckGo(html: string): { href: string; title: string }[] {
  const out: { href: string; title: string }[] = [];
  const re = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let href = m[1].replace(/&amp;/g, '&');
    const u = href.match(/[?&]uddg=([^&]+)/);
    if (u) { try { href = decodeURIComponent(u[1]); } catch { /* keep */ } }
    if (!/^https?:/i.test(href)) href = 'https:' + (href.startsWith('//') ? href : '//' + href.replace(/^\/+/, ''));
    out.push({ href, title: m[2] });
  }
  return out;
}

// Bing organic results: <li class="b_algo"> … <h2><a href="TARGET">Title</a>.
function parseBing(html: string): { href: string; title: string }[] {
  const out: { href: string; title: string }[] = [];
  const re = /<h2><a href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push({ href: m[1].replace(/&amp;/g, '&'), title: m[2] });
  return out;
}

async function runSearch(engine: 'ddg' | 'bing', query: string): Promise<{ hits: { href: string; title: string }[]; status: number }> {
  const url = engine === 'ddg'
    ? `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
    : `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=30`;
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 20000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', 'Accept': 'text/html' }, signal: ac.signal });
    const html = await res.text();
    const hits = engine === 'ddg' ? parseDuckDuckGo(html) : parseBing(html);
    return { hits, status: res.status };
  } catch { return { hits: [], status: 0 }; } finally { clearTimeout(to); }
}

export async function searchDiscovery(o: SourceOpts): Promise<SourceResult> {
  const term = (o.searchTerms || 'business').trim();
  const place = (o.city || o.geo || '').trim();
  const query = place ? `${term} in ${place}` : term;

  // DuckDuckGo first; fall back to Bing if it returns nothing / is challenged.
  let { hits, status } = await runSearch('ddg', query);
  let engine = 'duckduckgo';
  if (hits.length === 0) { const b = await runSearch('bing', query); if (b.hits.length) { hits = b.hits; status = b.status; engine = 'bing'; } }

  if (hits.length === 0) {
    return { candidates: [], status: status === 0 || status === 429 || status === 403 ? 'blocked' : 'empty', error: status ? `search http ${status}` : 'search unavailable' };
  }

  const seen = new Set<string>();
  const candidates: RawCandidate[] = [];
  const cap = Math.min(20, Math.max(o.limit + 6, 12));
  for (const h of hits) {
    let host: string;
    try { host = new URL(h.href).hostname.replace(/^www\./, ''); } catch { continue; }
    if (SKIP.test(host) || seen.has(host)) continue;
    seen.add(host);
    candidates.push({
      category: o.category,
      name: titleToName(h.title, host),
      website: `https://${host}`,
      location: o.geo ?? null, country: o.country ?? null, state: o.state ?? null, city: o.city ?? null,
      geo: o.geo ?? null, lat: o.lat ?? null, lng: o.lng ?? null,
      source_key: 'web_search',
      source_url: h.href,
      socials: {},
      raw: { engine, query, host },
    });
    if (candidates.length >= cap) break;
  }
  return { candidates, status: candidates.length ? 'ok' : 'empty' };
}
