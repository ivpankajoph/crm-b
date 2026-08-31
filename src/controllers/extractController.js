import UrlCache from '../models/UrlCache.js';
import { enrichCompanyWithGemini } from '../services/companyEnrichmentService.js';
import { scrapeWebsite } from '../services/urlScraperService.js';
import { normalizeDomain, validatePublicUrl } from '../utils/urlSecurity.js';
import { successResponse } from '../utils/response.js';

const EXTRACTOR_VERSION = 3;

export const enrichUrl = async (req, res, next) => {
  try {
    const validatedUrl = await validatePublicUrl(req.body?.url);
    const domain = normalizeDomain(validatedUrl);
    const cached = await UrlCache.findOne({ domain }).lean();

    if (cached?.data && cached.extractorVersion === EXTRACTOR_VERSION) {
      return successResponse(res, 200, 'Website details Fetched Successfully', {
        source: 'cache',
        domain,
        websiteUrl: validatedUrl.href,
        data: cached.data,
      });
    }

    const scraped = await scrapeWebsite(validatedUrl.href);
    const data = await enrichCompanyWithGemini({
      websiteUrl: scraped.finalUrl,
      extractedText: scraped.text,
    });

    await UrlCache.findOneAndUpdate(
      { domain },
      { $set: { data, extractorVersion: EXTRACTOR_VERSION, cachedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return successResponse(res, 200, 'Website details extracted', {
      source: 'website',
      scraperTier: scraped.tier,
      domain,
      websiteUrl: scraped.finalUrl,
      data,
    });
  } catch (error) {
    if (error.code === 'ERR_BAD_RESPONSE' || error.code === 'ECONNABORTED') {
      error.statusCode = 422;
      error.message = 'The website could not be scanned within the allowed time';
    }
    next(error);
  }
};
