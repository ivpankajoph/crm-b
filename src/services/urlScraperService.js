import http from 'node:http';
import https from 'node:https';
import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import { safeDnsLookup, validatePublicUrl } from '../utils/urlSecurity.js';

const REQUEST_TIMEOUT_MS = 12_000;
const PUPPETEER_TIMEOUT_MS = 18_000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const MAX_PAGE_TEXT = 20_000;
const MAX_MAIN_TEXT = 12_000;
const MAX_CONTACT_TEXT = 4_000;
const MAX_FOOTER_TEXT = 4_000;
const MAX_STRUCTURED_TEXT = 4_000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const httpAgent = new http.Agent({ keepAlive: true, lookup: safeDnsLookup });
const httpsAgent = new https.Agent({ keepAlive: true, lookup: safeDnsLookup });

const cleanText = (value, maxLength = MAX_PAGE_TEXT) => String(value || '')
  .replace(/\u0000/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, maxLength);

const unique = (values) => [...new Set(values.map((value) => cleanText(value, 500)).filter(Boolean))];

const withDeadline = (promise, timeoutMs, message) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  Promise.resolve(promise).then(
    (value) => {
      clearTimeout(timer);
      resolve(value);
    },
    (error) => {
      clearTimeout(timer);
      reject(error);
    },
  );
});

const buildSemanticText = ({ contactText, footerText, structuredText, headerText, mainText }) => cleanText([
  contactText && `CONTACT/ADDRESS SECTION: ${contactText}`,
  footerText && `FOOTER: ${footerText}`,
  structuredText && `STRUCTURED DATA: ${structuredText}`,
  headerText && `HEADER: ${headerText}`,
  mainText && `MAIN CONTENT: ${mainText}`,
].filter(Boolean).join('\n'), MAX_PAGE_TEXT);

const fetchHtml = async (inputUrl) => {
  let currentUrl = await validatePublicUrl(inputUrl);
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const response = await axios.get(currentUrl.href, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      responseType: 'text',
      maxRedirects: 0,
      maxContentLength: MAX_HTML_BYTES,
      maxBodyLength: MAX_HTML_BYTES,
      httpAgent,
      httpsAgent,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    if (response.status >= 300) {
      const location = response.headers.location;
      if (!location || redirectCount === MAX_REDIRECTS) throw new Error('Website redirected too many times');
      currentUrl = await validatePublicUrl(new URL(location, currentUrl));
      continue;
    }

    const contentType = String(response.headers['content-type'] || '').toLowerCase();
    if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml') && !contentType.includes('text/plain')) {
      const error = new Error('The URL did not return an HTML webpage');
      error.statusCode = 422;
      throw error;
    }
    return { html: String(response.data || ''), finalUrl: currentUrl.href };
  }
  throw new Error('Unable to fetch website');
};

export const extractStaticPage = ({ html, finalUrl }) => {
  const $ = cheerio.load(html);
  const title = cleanText($('title').first().text(), 300);
  const description = cleanText(
    $('meta[name="description"]').attr('content')
      || $('meta[property="og:description"]').attr('content'),
    600,
  );
  const structuredText = cleanText(
    $('script[type="application/ld+json"]')
      .map((_, element) => $(element).text())
      .get()
      .join(' '),
    MAX_STRUCTURED_TEXT,
  );
  $('script, style, noscript, svg, template').remove();
  const headerText = cleanText($('header').first().text(), 1_500);
  const footerText = cleanText($('footer').first().text(), MAX_FOOTER_TEXT);
  const contactText = cleanText(
    $('address, [itemprop="address"], [class*="contact"], [id*="contact"], [class*="location"], [id*="location"]')
      .map((_, element) => $(element).text())
      .get()
      .join(' '),
    MAX_CONTACT_TEXT,
  );
  const bodyClone = $('body').clone();
  bodyClone.find('header, footer, nav, script, style, noscript, svg, template').remove();
  const mainText = cleanText($('main').first().text() || bodyClone.text(), MAX_MAIN_TEXT);
  const bodyText = buildSemanticText({ contactText, footerText, structuredText, headerText, mainText });
  const emails = [];
  const phones = [];
  const relevantLinks = { contact: '', about: '' };

  $('a[href]').each((_, element) => {
    const href = String($(element).attr('href') || '').trim();
    if (/^mailto:/i.test(href)) emails.push(href.replace(/^mailto:/i, '').split('?')[0]);
    if (/^tel:/i.test(href)) phones.push(decodeURIComponent(href.replace(/^tel:/i, '').split('?')[0]));
    try {
      const resolved = new URL(href, finalUrl);
      const current = new URL(finalUrl);
      if (resolved.origin !== current.origin || !['http:', 'https:'].includes(resolved.protocol)) return;
      if (resolved.pathname === current.pathname && resolved.search === current.search && resolved.hash) return;
      const hint = `${resolved.pathname} ${$(element).text()}`.toLowerCase();
      if (!relevantLinks.contact && /contact|reach-us|get-in-touch/.test(hint)) relevantLinks.contact = resolved.href;
      if (!relevantLinks.about && /about|company|who-we-are/.test(hint)) relevantLinks.about = resolved.href;
    } catch {
      // Ignore malformed links discovered in third-party HTML.
    }
  });

  return {
    url: finalUrl,
    title,
    description,
    bodyText,
    emails: unique(emails),
    phones: unique(phones),
    relevantLinks,
    sections: { contactText, footerText, structuredText, headerText, mainText },
  };
};

const scrapeWithCheerio = async (websiteUrl) => {
  const homepage = extractStaticPage(await fetchHtml(websiteUrl));
  const origin = new URL(homepage.url).origin;
  const pageUrls = unique([
    homepage.relevantLinks.contact || `${origin}/contact`,
    homepage.relevantLinks.about || `${origin}/about`,
  ]).slice(0, 2);
  const secondaryPages = await Promise.all(pageUrls.map(async (pageUrl) => {
    try {
      return extractStaticPage(await fetchHtml(pageUrl));
    } catch {
      return null;
    }
  }));
  const pages = [homepage, ...secondaryPages.filter(Boolean)];
  return {
    tier: 'cheerio',
    finalUrl: homepage.url,
    pages,
    text: pages.map((page) => [
      `PAGE: ${page.url}`,
      `TITLE: ${page.title}`,
      `META DESCRIPTION: ${page.description}`,
      `EMAIL LINKS: ${page.emails.join(', ')}`,
      `PHONE LINKS: ${page.phones.join(', ')}`,
      `BODY: ${page.bodyText}`,
    ].join('\n')).join('\n\n'),
    meaningfulTextLength: cleanText(homepage.bodyText, 50_000).length,
  };
};

const scrapeWithPuppeteer = async (websiteUrl) => {
  const safeUrl = await validatePublicUrl(websiteUrl);
  const browser = await puppeteer.launch({
    headless: true,
    protocolTimeout: PUPPETEER_TIMEOUT_MS + 5_000,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ['--disable-dev-shm-usage', '--disable-http2'],
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setRequestInterception(true);
    page.on('request', async (request) => {
      try {
        if (['image', 'media', 'font'].includes(request.resourceType())) return request.abort();
        await validatePublicUrl(request.url());
        return request.continue();
      } catch {
        return request.abort();
      }
    });
    page.setDefaultNavigationTimeout(PUPPETEER_TIMEOUT_MS);
    let response;
    let navigationTimedOut = false;
    try {
      response = await page.goto(safeUrl.href, { waitUntil: 'domcontentloaded' });
    } catch (error) {
      if (error.name !== 'TimeoutError') throw error;
      navigationTimedOut = true;
      const client = await page.createCDPSession();
      await withDeadline(client.send('Page.stopLoading'), 2_000, 'Could not stop timed-out navigation')
        .catch(() => undefined);
    }
    if (!response && !navigationTimedOut) throw new Error('The dynamic website did not return a response');
    await validatePublicUrl(response?.url() || page.url());
    await page.waitForFunction(
      () => (document.body?.innerText || '').trim().length >= 150,
      { timeout: 3_000 },
    ).catch(() => undefined);
    const extracted = await withDeadline(page.evaluate((limits) => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      const textFrom = (selector, maxLength) => Array.from(document.querySelectorAll(selector))
        .map((element) => element.textContent || '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
      const main = document.querySelector('main');
      return {
        title: document.title || '',
        description: document.querySelector('meta[name="description"]')?.getAttribute('content')
          || document.querySelector('meta[property="og:description"]')?.getAttribute('content')
          || '',
        headerText: textFrom('header', limits.header),
        footerText: textFrom('footer', limits.footer),
        contactText: textFrom('address, [itemprop="address"], [class*="contact"], [id*="contact"], [class*="location"], [id*="location"]', limits.contact),
        structuredText: Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
          .map((element) => element.textContent || '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, limits.structured),
        mainText: ((main?.textContent || document.body?.innerText) || '').replace(/\s+/g, ' ').trim().slice(0, limits.main),
        emails: links.map((link) => link.getAttribute('href') || '').filter((href) => /^mailto:/i.test(href)).map((href) => href.replace(/^mailto:/i, '').split('?')[0]),
        phones: links.map((link) => link.getAttribute('href') || '').filter((href) => /^tel:/i.test(href)).map((href) => href.replace(/^tel:/i, '').split('?')[0]),
      };
    }, {
      header: 1_500,
      footer: MAX_FOOTER_TEXT,
      contact: MAX_CONTACT_TEXT,
      structured: MAX_STRUCTURED_TEXT,
      main: MAX_MAIN_TEXT,
    }), 6_000, 'The dynamic website DOM could not be read in time');
    const finalUrl = page.url();
    const sections = {
      contactText: cleanText(extracted.contactText, MAX_CONTACT_TEXT),
      footerText: cleanText(extracted.footerText, MAX_FOOTER_TEXT),
      structuredText: cleanText(extracted.structuredText, MAX_STRUCTURED_TEXT),
      headerText: cleanText(extracted.headerText, 1_500),
      mainText: cleanText(extracted.mainText, MAX_MAIN_TEXT),
    };
    const pageData = {
      url: finalUrl,
      title: cleanText(extracted.title, 300),
      description: cleanText(extracted.description, 600),
      bodyText: buildSemanticText(sections),
      emails: unique(extracted.emails),
      phones: unique(extracted.phones),
      sections,
    };
    return {
      tier: 'puppeteer',
      finalUrl,
      pages: [pageData],
      text: [
        `PAGE: ${finalUrl}`,
        `TITLE: ${pageData.title}`,
        `META DESCRIPTION: ${pageData.description}`,
        `EMAIL LINKS: ${pageData.emails.join(', ')}`,
        `PHONE LINKS: ${pageData.phones.join(', ')}`,
        `BODY: ${pageData.bodyText}`,
      ].join('\n'),
      meaningfulTextLength: pageData.bodyText.length,
    };
  } finally {
    await withDeadline(browser.close(), 5_000, 'Browser close timed out').catch(() => {
      browser.process()?.kill();
    });
  }
};

export const scrapeWebsite = async (websiteUrl) => {
  let staticResult;
  try {
    staticResult = await scrapeWithCheerio(websiteUrl);
    if (staticResult.meaningfulTextLength >= 150) return staticResult;
  } catch (error) {
    const retryableCodes = new Set([
      'ECONNABORTED',
      'ECONNRESET',
      'ETIMEDOUT',
      'ERR_NETWORK',
      'ERR_BAD_RESPONSE',
    ]);
    if (error.statusCode === 400 || !retryableCodes.has(error.code)) throw error;
  }

  const dynamicResult = await scrapeWithPuppeteer(staticResult?.finalUrl || websiteUrl);
  if (dynamicResult.meaningfulTextLength < 150) {
    const error = new Error('Not enough public website content was available to extract company details');
    error.statusCode = 422;
    throw error;
  }
  return dynamicResult;
};
