// Free geocoding via OpenStreetMap Nominatim (cached per query in geo_cache).
// Nominatim policy: max 1 req/s + a valid identifying User-Agent.
import { geoCacheGet, geoCachePut } from '../sink/db';

export async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  const cached = await geoCacheGet(query);
  if (cached) return cached;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const ua = `leadgen-scraper/1.0 (${process.env.LEADGEN_GMAIL_USER || 'contact@example.com'})`;
  const res = await fetch(url, { headers: { 'User-Agent': ua, 'Accept-Language': 'en' } });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!Array.isArray(data) || !data.length) return null;
  const lat = parseFloat(data[0].lat);
  const lng = parseFloat(data[0].lon);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  await geoCachePut(query, lat, lng);
  return { lat, lng };
}
