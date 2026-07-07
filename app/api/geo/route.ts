import { Country, State, City } from 'country-state-city';
import { NextRequest, NextResponse } from 'next/server';

// Cascading location options from the free offline dataset (with coordinates).
//   /api/geo                          → countries
//   /api/geo?country=US               → states of US
//   /api/geo?country=US&state=TX      → cities of Texas
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const country = sp.get('country');
  const state = sp.get('state');
  const n = (v: string) => { const f = parseFloat(v); return Number.isFinite(f) ? f : null; };

  if (country && state) {
    const cities = City.getCitiesOfState(country, state).map((c) => ({ name: c.name, lat: n(c.latitude || ''), lng: n(c.longitude || '') }));
    return NextResponse.json(cities);
  }
  if (country) {
    const states = State.getStatesOfCountry(country).map((s) => ({ name: s.name, iso: s.isoCode, lat: n(s.latitude || ''), lng: n(s.longitude || '') }));
    return NextResponse.json(states);
  }
  const countries = Country.getAllCountries().map((c) => ({ name: c.name, iso: c.isoCode, lat: n(c.latitude || ''), lng: n(c.longitude || '') }));
  return NextResponse.json(countries);
}
