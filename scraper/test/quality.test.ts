// Quick assertions for the quality lib. Run: npx tsx test/quality.test.ts
import assert from 'node:assert';
import { entityKey } from '../src/quality/entity';
import { verifyPhone } from '../src/quality/verifyPhone';
import { computeConfidence } from '../src/quality/confidence';
import { validateBatch } from '../src/quality/dedupe';
import { isPlaceholderEmail, isSharedHost } from '../src/quality/disposable';
import { normalizeName, websiteDomain, geocell } from '../src/quality/normalize';

let pass = 0;
const t = (name: string, fn: () => void) => { fn(); pass++; console.log('  ok -', name); };

console.log('quality lib tests:');

t('normalizeName strips legal suffixes', () => {
  assert.equal(normalizeName('Acme Plumbing LLC'), 'acme plumbing');
  assert.equal(normalizeName('The Vertex Group, Inc.'), 'vertex');
});

t('websiteDomain returns registrable domain', () => {
  assert.equal(websiteDomain('https://www.acme.co.uk/contact'), 'acme.co.uk');
  assert.equal(websiteDomain('shop.example.com'), 'example.com');
});

t('entityKey: owned domain → dom:', () => {
  assert.equal(entityKey({ name: 'Acme', website_domain: 'acme.com' }), 'dom:acme.com');
});

t('entityKey: shared host falls back to name+geocell', () => {
  assert.ok(isSharedHost('myshopify.com'));
  assert.equal(
    entityKey({ name: 'Acme Plumbing', website_domain: 'myshopify.com', lat: 30.267, lng: -97.743 }),
    'nc:acmeplumbing|30.27,-97.74'
  );
});

t('entityKey: order-independent (same key both ways)', () => {
  const a = entityKey({ name: 'Bob Co', website_domain: 'bobco.com', lat: 30.2, lng: -97.7 });
  const b = entityKey({ name: 'BOB CO LLC', website_domain: 'www.bobco.com' });
  assert.equal(a, b); // both dom:bobco.com
});

t('entityKey: phone+name, never phone-alone', () => {
  assert.equal(entityKey({ name: 'Bob Plumbing', phone_e164: '+15125551234' }), 'tel:+15125551234|bobplumbing');
  assert.equal(entityKey({ phone_e164: '+15125551234' }), null); // no name → cannot key on phone alone
});

t('entityKey: unresolvable → null', () => {
  assert.equal(entityKey({ name: 'Nameless' }), null); // no domain/phone/geo
});

t('verifyPhone: valid US with explicit country code', () => {
  const v = verifyPhone('+1 415 863 9900', 'Austin, TX');
  assert.equal(v.phone_status, 'valid');
  assert.equal(v.phone_e164, '+14158639900');
  assert.equal(v.country_defaulted, false);
});

t('verifyPhone: defaulted country flagged', () => {
  const v = verifyPhone('(415) 863-9900', 'Austin, TX');
  assert.equal(v.phone_status, 'valid');
  assert.equal(v.country_defaulted, true);
});

t('verifyPhone: junk → invalid', () => {
  assert.equal(verifyPhone('not-a-number', 'Austin, TX').phone_status, 'invalid');
});

t('isPlaceholderEmail catches web-dev noise', () => {
  assert.ok(isPlaceholderEmail('you@example.com'));
  assert.ok(isPlaceholderEmail('hash@2x.png'));
  assert.ok(!isPlaceholderEmail('info@acmeplumbing.com'));
});

t('computeConfidence: ok+mx high, disposable spam', () => {
  const good = computeConfidence({ email_status: 'ok', mx_found: true, phone_status: 'valid', has_website: true, has_name: true, is_disposable: false, is_role_account: false, is_placeholder: false, phone_country_defaulted: false });
  assert.ok(good.confidence >= 80, `expected >=80 got ${good.confidence}`);
  assert.equal(good.is_spam_risk, false);
  const bad = computeConfidence({ email_status: 'disposable', mx_found: null, phone_status: null, has_website: false, has_name: true, is_disposable: true, is_role_account: false, is_placeholder: false, phone_country_defaulted: false });
  assert.ok(bad.is_spam_risk);
});

t('geocell rounds coords / falls back to city', () => {
  assert.equal(geocell(30.2672, -97.7431, null), '30.27,-97.74');
  assert.equal(geocell(null, null, 'Austin, TX'), 'city:austin, tx');
});

t('validateBatch: empty rejected', () => {
  assert.equal(validateBatch([]).ok, false);
  assert.equal(validateBatch([{ category: 'b2b', source_key: 'osm_overpass' }]).ok, true);
});

console.log(`\n${pass} assertions passed ✅`);
