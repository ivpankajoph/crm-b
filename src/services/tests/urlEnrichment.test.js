import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import UrlCache from '../../models/UrlCache.js';
import { normalizeEnrichmentData } from '../companyEnrichmentService.js';
import { extractStaticPage } from '../urlScraperService.js';
import { toPublicUrlEnrichmentError } from '../urlEnrichmentErrorService.js';
import {
  isPublicIpAddress,
  normalizeDomain,
  normalizeWebsiteUrl,
  validatePublicUrl,
} from '../../utils/urlSecurity.js';

test('URL normalization accepts websites and rejects unsafe protocols and hosts', () => {
  assert.equal(normalizeWebsiteUrl('example.com/contact').href, 'https://example.com/contact');
  assert.equal(normalizeDomain('https://www.Example.com/path'), 'example.com');
  assert.throws(() => normalizeWebsiteUrl('ftp://example.com'), /Only HTTP and HTTPS/i);
  assert.throws(() => normalizeWebsiteUrl('http://localhost:8080'), /not allowed/i);
  assert.throws(() => normalizeWebsiteUrl('http://service.internal'), /not allowed/i);
});

test('SSRF address filtering blocks private, loopback, link-local, and metadata destinations', async () => {
  for (const address of ['127.0.0.1', '10.10.0.1', '172.16.5.4', '192.168.1.10', '169.254.169.254', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1', '2001:db8::1']) {
    assert.equal(isPublicIpAddress(address), false, `${address} should be blocked`);
  }
  assert.equal(isPublicIpAddress('8.8.8.8'), true);
  assert.equal(isPublicIpAddress('2606:4700:4700::1111'), true);
  await assert.rejects(validatePublicUrl('http://2130706433'), /private or reserved/i);
});

test('Gemini enrichment normalization keeps the expected form-safe structure', () => {
  const result = normalizeEnrichmentData({
    companyName: ' Example Ltd ',
    primaryPerson: 'Jane Doe',
    primaryEmail: 'SALES@EXAMPLE.COM',
    secondaryEmail: 'SUPPORT@EXAMPLE.COM',
    primaryPhone: '+91 98765 43210',
    alternatePhone: '011 4567 8901',
    city: 'Mumbai',
    address: '1 Example Road',
    description: 'Cloud software',
    businessType: 'Information Technology (IT)',
    confidence: {
      companyName: 'high', primaryPerson: 'medium', primaryEmail: 'high', secondaryEmail: 'high',
      primaryPhone: 'high', alternatePhone: 'medium',
      city: 'medium', address: 'medium', description: 'medium', businessType: 'high',
    },
  });
  assert.equal(result.companyName, 'Example Ltd');
  assert.equal(result.primaryEmail, 'sales@example.com');
  assert.equal(result.secondaryEmail, 'support@example.com');
  assert.equal(result.alternatePhone, '011 4567 8901');
  assert.equal(result.confidence.companyName, 'high');
});

test('duplicate secondary contact values are removed after normalization', () => {
  const result = normalizeEnrichmentData({
    companyName: 'Example Ltd', primaryPerson: '',
    primaryEmail: 'sales@example.com', secondaryEmail: 'SALES@example.com',
    primaryPhone: '+91 98765 43210', alternatePhone: '9876543210',
    city: '', address: '', description: '', businessType: 'Other',
    confidence: Object.fromEntries([
      'companyName', 'primaryPerson', 'primaryEmail', 'secondaryEmail', 'primaryPhone',
      'alternatePhone', 'city', 'address', 'description', 'businessType',
    ].map((field) => [field, 'high'])),
  });
  assert.equal(result.secondaryEmail, '');
  assert.equal(result.alternatePhone, '');
  assert.equal(result.confidence.secondaryEmail, 'low');
  assert.equal(result.confidence.alternatePhone, 'low');
});

test('URL cache has a unique domain and 15-day TTL declaration', () => {
  assert.equal(UrlCache.schema.path('domain').options.unique, true);
  assert.equal(UrlCache.schema.path('cachedAt').options.expires, '15d');
});

test('semantic extraction preserves footer contact details after long main content', () => {
  const page = extractStaticPage({
    finalUrl: 'https://example.com/',
    html: `<html><head><title>Example</title></head><body>
      <main>${'Long marketing content '.repeat(500)}</main>
      <footer><div class="contact-info">Office No 10150, Gaur City Mall, Noida Extension, 201301</div></footer>
    </body></html>`,
  });
  assert.match(page.bodyText, /Office No 10150, Gaur City Mall/);
  assert.match(page.sections.footerText, /Noida Extension, 201301/);
});

test('URL enrichment route requires authentication and lead-create permission', () => {
  const routes = fs.readFileSync(new URL('../../routes/leadRoutes.js', import.meta.url), 'utf8');
  assert.match(routes, /'\/enrich-url',[\s\S]*protect,[\s\S]*PERMISSIONS\.LEADS_CREATE[\s\S]*enrichUrl/);
});

test('tiered scraper includes retryable network failures before Puppeteer fallback', () => {
  const scraper = fs.readFileSync(new URL('../urlScraperService.js', import.meta.url), 'utf8');
  assert.match(scraper, /ECONNABORTED/);
  assert.match(scraper, /ERR_NETWORK/);
  assert.match(scraper, /scrapeWithPuppeteer\(staticResult\?\.finalUrl \|\| websiteUrl\)/);
});

test('URL enrichment hides provider errors behind user-friendly messages', () => {
  const permissionError = toPublicUrlEnrichmentError(Object.assign(
    new Error('{"error":{"code":403,"message":"Lightning dunning decision is deny"}}'),
    { status: 403 },
  ));
  assert.equal(permissionError.statusCode, 503);
  assert.match(permissionError.message, /temporarily unavailable/i);
  assert.doesNotMatch(permissionError.message, /Gemini|dunning|403|project/i);

  const retiredModelError = toPublicUrlEnrichmentError(Object.assign(
    new Error('This model is no longer available'),
    { status: 404 },
  ));
  assert.equal(retiredModelError.statusCode, 503);
  assert.doesNotMatch(retiredModelError.message, /model|404/i);
});

test('URL enrichment keeps validation useful and maps busy or unreachable services', () => {
  assert.equal(
    toPublicUrlEnrichmentError(Object.assign(new Error('Enter a valid website URL'), { statusCode: 400 })).message,
    'Enter a valid website URL',
  );
  assert.match(
    toPublicUrlEnrichmentError(Object.assign(new Error('quota exceeded'), { status: 429 })).message,
    /currently busy/i,
  );
  assert.match(
    toPublicUrlEnrichmentError(Object.assign(new Error('timeout'), { code: 'ECONNABORTED' })).message,
    /could not access/i,
  );
});
