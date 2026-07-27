import { performance } from 'node:perf_hooks';

const byteLength = (chunk, encoding) => {
  if (!chunk) return 0;
  if (Buffer.isBuffer(chunk)) return chunk.length;
  if (typeof chunk === 'string') return Buffer.byteLength(chunk, encoding);
  if (chunk instanceof Uint8Array) return chunk.byteLength;
  return 0;
};

export const normalizeRoute = (url = '') => {
  const pathname = String(url).split('?')[0] || '/';
  return pathname
    .replace(/\/[a-f\d]{24}(?=\/|$)/gi, '/:id')
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}(?=\/|$)/gi, '/:id')
    .replace(/\/\d+(?=\/|$)/g, '/:number');
};

export const createPerformanceTiming = ({
  thresholdMs = Number(process.env.SLOW_REQUEST_THRESHOLD_MS || 500),
  logAll = String(process.env.PERFORMANCE_LOG_ALL || '').toLowerCase() === 'true',
  logger = (entry) => console.info(JSON.stringify(entry)),
  now = () => performance.now(),
} = {}) => (req, res, next) => {
  if (!String(req.originalUrl || req.url || '').startsWith('/api/')) return next();

  const startedAt = now();
  let responseBytes = 0;
  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);

  res.write = (chunk, encoding, callback) => {
    responseBytes += byteLength(chunk, typeof encoding === 'string' ? encoding : undefined);
    return originalWrite(chunk, encoding, callback);
  };
  res.end = (chunk, encoding, callback) => {
    responseBytes += byteLength(chunk, typeof encoding === 'string' ? encoding : undefined);
    if (!res.headersSent) {
      const duration = Math.max(0, now() - startedAt);
      const currentTiming = res.getHeader('Server-Timing');
      const appTiming = `app;dur=${duration.toFixed(1)}`;
      res.setHeader('Server-Timing', currentTiming ? `${currentTiming}, ${appTiming}` : appTiming);
    }
    return originalEnd(chunk, encoding, callback);
  };

  res.once('finish', () => {
    const durationMs = Number(Math.max(0, now() - startedAt).toFixed(1));
    if (!logAll && durationMs < thresholdMs) return;
    logger({
      event: durationMs >= thresholdMs ? 'slow_request' : 'api_request',
      method: req.method,
      route: normalizeRoute(req.originalUrl || req.url),
      status: res.statusCode,
      durationMs,
      responseBytes,
      cache: res.getHeader('X-Cache') || undefined,
    });
  });

  next();
};

export const performanceTiming = createPerformanceTiming();
