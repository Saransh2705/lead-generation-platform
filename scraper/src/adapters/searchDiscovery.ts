// Search-driven discovery: query a scrape-tolerant search engine (DuckDuckGo,
// with Bing as fallback) for "{business type} in {place}", harvest organic result
// websites, MINE directory/listicle pages for the individual businesses they list,
// and hand every business site to the shared enrichment step (email/phone/logo/
// description). No browser needed — plain HTTP fetch, which survives datacenter IPs
// where Google/Yelp hard-block.
import type { RawCandidate } from '../quality/types';
import type { SourceOpts, SourceResult } from './yellowPages';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

// Aggregators / socials / portals / infra that are never a single business's own site.
const SKIP = /(^|\.)(google|googleapis|gstatic|goo|bing|duckduckgo|duck|youtube|facebook|fb|instagram|linkedin|twitter|x|t|tiktok|pinterest|wikipedia|wikimedia|tripadvisor|yelp|justdial|sulekha|indeed|naukri|glassdoor|quora|reddit|medium|blogspot|wordpress|wix|squarespace|godaddy|amazon|booking|expedia|makemytrip|goibibo|yatra|scribd|slideshare|issuu|whatsapp|wa|maps|apple|bit|w3|schema)\.|(^|\.)(cloudflare|cloudfront|akamai|akamaihd|fastly|jsdelivr|unpkg|bootstrapcdn|maxcdn|fontawesome|jquery|gravatar|cdn)\.|(^|\.)(chatgpt|openai|perplexity|anthropic|claude|gemini|bard)\.|(^|\.)(jdoqocy|dpbolvw|anrdoezrs|tkqlhce|kqzyfj|shareasale|awin|impactradius|commission)\.|(^|\.)(cdn|assets|static|cdn2|img|images|fonts|ajax)\./i;
// Domains that are directory/listicle sites — useful to MINE, but not leads themselves.
const DIRECTORY_HOSTS = /(^|\.)(edarabia|easyuae|holidify|dubailocal|traveltodubai|travelagencies|tourismrendezvous|emiratesdiary|clutch|goodfirms|trustpilot|ambitionbox|3bestrated|threebestrated|yellowpages|yellowpages-uae|yell|yalwa|hotfrog|cylex|bizfinder|brownbook|manta|sortlist|2gis|dnb|zaubacorp)\./i;
const DIRECTORY_TITLE = /\btop\s*\d+|\blist of\b|\b\d+\s+(best|top)\b|\bbest\b.{0,30}\b(agenc|compan|firm|service|operator)|\bdirectory\b|\bagencies in\b/i;

function titleToName(title: string, host: string): string {
  const clean = title.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").trim();
  const first = clean.split(/\s[|\-–—:•]\s/)[0].trim();
  return first && first.length > 1 ? first : host.replace(/\.[a-z.]+$/, '');
}

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

function parseBing(html: string): { href: string; title: string }[] {
  const out: { href: string; title: string }[] = [];
  const re = /<h2><a href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push({ href: m[1].replace(/&amp;/g, '&'), title: m[2] });
  return out;
}

async function fetchHtml(url: string, ms = 18000): Promise<{ html: string; status: number }> {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', 'Accept': 'text/html' }, signal: ac.signal });
    return { html: await res.text(), status: res.status };
  } catch { return { html: '', status: 0 }; } finally { clearTimeout(to); }
}

async function runSearch(engine: 'ddg' | 'bing', query: string): Promise<{ hits: { href: string; title: string }[]; status: number }> {
  const url = engine === 'ddg'
    ? `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
    : `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=30`;
  const { html, status } = await fetchHtml(url);
  return { hits: engine === 'ddg' ? parseDuckDuckGo(html) : parseBing(html), status };
}

// Mine a directory/listicle page: pull outbound links to *other* businesses' own sites.
async function mineDirectory(url: string, dirHost: string): Promise<string[]> {
  const { html } = await fetchHtml(url, 15000);
  if (!html) return [];
  const hosts = new Set<string>();
  const re = /href="(https?:\/\/[^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let host: string;
    try { host = new URL(m[1]).hostname.replace(/^www\./, ''); } catch { continue; }
    if (host === dirHost || SKIP.test(host) || DIRECTORY_HOSTS.test(host)) continue;
    hosts.add(host);
    if (hosts.size >= 15) break;
  }
  return [...hosts];
}

export async function searchDiscovery(o: SourceOpts): Promise<SourceResult> {
  const term = (o.searchTerms || 'business').trim();
  const place = (o.city || o.geo || '').trim();
  const queries = place ? [`${term} in ${place}`, `best ${term} ${place} contact`] : [term];

  // Gather organic hits across query variants (DDG, Bing fallback on the first).
  const hitMap = new Map<string, { href: string; title: string }>();
  let lastStatus = 0;
  for (const q of queries) {
    let { hits, status } = await runSearch('ddg', q);
    if (hits.length === 0) { const b = await runSearch('bing', q); hits = b.hits; status = b.status; }
    lastStatus = status || lastStatus;
    for (const h of hits) hitMap.set(h.href, h);
  }
  const hits = [...hitMap.values()];
  if (hits.length === 0) {
    return { candidates: [], status: lastStatus === 429 || lastStatus === 403 || lastStatus === 0 ? 'blocked' : 'empty', error: lastStatus ? `search http ${lastStatus}` : 'search unavailable' };
  }

  const cap = Math.min(22, Math.max(o.limit + 8, 14));
  const seen = new Set<string>();
  const candidates: RawCandidate[] = [];
  const push = (host: string, name: string, sourceUrl: string, via: string) => {
    if (seen.has(host) || candidates.length >= cap) return;
    seen.add(host);
    candidates.push({
      category: o.category, name, website: `https://${host}`,
      location: o.geo ?? null, country: o.country ?? null, state: o.state ?? null, city: o.city ?? null,
      geo: o.geo ?? null, lat: o.lat ?? null, lng: o.lng ?? null,
      source_key: 'web_search', source_url: sourceUrl, socials: {}, raw: { via, host },
    });
  };

  // Pass 1: direct business results. Collect directory pages to mine (cap 3).
  const toMine: { url: string; host: string }[] = [];
  for (const h of hits) {
    let host: string;
    try { host = new URL(h.href).hostname.replace(/^www\./, ''); } catch { continue; }
    if (SKIP.test(host)) continue;
    const isDir = DIRECTORY_HOSTS.test(host) || DIRECTORY_TITLE.test(h.title.replace(/<[^>]+>/g, ''));
    if (isDir) { if (toMine.length < 3) toMine.push({ url: h.href, host }); continue; }
    push(host, titleToName(h.title, host), h.href, 'search');
  }

  // Pass 2: mine directory/listicle pages into individual business sites.
  for (const d of toMine) {
    if (candidates.length >= cap) break;
    const businessHosts = await mineDirectory(d.url, d.host);
    for (const bh of businessHosts) push(bh, bh.replace(/\.[a-z.]+$/, ''), `https://${d.host}`, `directory:${d.host}`);
  }

  return { candidates: candidates.length ? candidates : [], status: candidates.length ? 'ok' : 'empty' };
}
