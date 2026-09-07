import UrlCache from '../models/UrlCache.js';
import { enrichCompanyWithGemini } from '../services/companyEnrichmentService.js';
import { scrapeWebsite } from '../services/urlScraperService.js';
import { normalizeDomain, validatePublicUrl } from '../utils/urlSecurity.js';
import { successResponse } from '../utils/response.js';
import { toPublicUrlEnrichmentError } from '../services/urlEnrichmentErrorService.js';

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
    console.error('[Website import] Technical failure:', {
      status: error.statusCode || error.status || error.response?.status,
      code: error.code || error.response?.data?.error?.status,
      message: error.message,
    });
    next(toPublicUrlEnrichmentError(error));
  }
};
