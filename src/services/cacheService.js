import crypto from 'crypto';
import Redis from 'ioredis';

const inFlight = new Map();
let redisClient;
let redisDisabled = false;
let redisUnavailableLogged = false;
const cacheMetrics = {
  hits: 0,
  misses: 0,
  shared: 0,
  redisErrors: 0,
  redisBypasses: 0,
  writes: 0,
};

export const getCacheMetrics = () => ({ ...cacheMetrics, inFlight: inFlight.size });

const getRedisUrl = () => {
  const explicitUrl = String(process.env.REDIS_URL || '').trim();
  if (explicitUrl) return explicitUrl;

  const host = String(process.env.REDIS_HOST || '').trim();
  if (!host) return '';

  const port = String(process.env.REDIS_PORT || '6379').trim() || '6379';
  const password = String(process.env.REDIS_PASSWORD || '').trim();
  const auth = password ? `:${encodeURIComponent(password)}@` : '';
  return `redis://${auth}${host}:${port}`;
};

const getRedisClient = () => {
  const redisUrl = getRedisUrl();
  if (!redisUrl) return null;
  if (redisClient) return redisClient;

  redisClient = new Redis(redisUrl, {
    lazyConnect: true,
    enableOfflineQueue: false,
    connectTimeout: 750,
    commandTimeout: 750,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });
  redisClient.on('error', (error) => {
    if (!redisUnavailableLogged) {
      redisUnavailableLogged = true;
      console.warn('[MetricsCache] Redis unavailable; continuing without cache:', error.message);
    }
  });
  return redisClient;
};

const runRedis = async (operation) => {
  if (redisDisabled) {
    cacheMetrics.redisBypasses += 1;
    return null;
  }
  const client = getRedisClient();
  if (!client) {
    cacheMetrics.redisBypasses += 1;
    return null;
  }

  try {
    if (client.status === 'wait') await client.connect();
    if (client.status !== 'ready') return null;
    return await operation(client);
  } catch (error) {
    cacheMetrics.redisErrors += 1;
    redisDisabled = true;
    if (!redisUnavailableLogged) {
      redisUnavailableLogged = true;
      console.warn('[MetricsCache] Redis operation failed; continuing without cache:', error.message);
    }
    return null;
  }
};

export const isFeatureEnabled = (name, defaultValue = true) => {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  return !['0', 'false', 'off', 'no'].includes(String(value).trim().toLowerCase());
};

export const stableFiltersHash = (filters = {}) => {
  const normalized = Object.keys(filters)
    .sort()
    .reduce((result, key) => {
      result[key] = filters[key] ?? '';
      return result;
    }, {});
  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex').slice(0, 16);
};

const getMetricsVersion = async () => (
  await runRedis((client) => client.get('crm:lead-metrics:version')) || '0'
);

export const buildDashboardMetricsCacheKey = async ({ userId, role, period, month, year, implementation = 'v2' }) => {
  const version = await getMetricsVersion();
  return `dashboard:metrics:v${version}:${implementation}:${userId}:${role}:${period}:${month || ''}:${year || ''}`;
};

export const buildLeadStatsCacheKey = async ({ userId, role, filters }) => {
  const version = await getMetricsVersion();
  return `leads:stats:v${version}:${userId}:${role}:${stableFiltersHash(filters)}`;
};

export const withSafeCache = async ({ key, ttlSeconds = 45 }, producer) => {
  const cached = await runRedis((client) => client.get(key));
  if (cached) {
    try {
      const value = JSON.parse(cached);
      cacheMetrics.hits += 1;
      return { value, cacheStatus: 'hit' };
    } catch {
      // Ignore a malformed cache entry and refresh it from the database.
    }
  }

  if (inFlight.has(key)) {
    cacheMetrics.shared += 1;
    return { value: await inFlight.get(key), cacheStatus: 'shared' };
  }

  cacheMetrics.misses += 1;
  const pending = Promise.resolve().then(producer);
  inFlight.set(key, pending);
  try {
    const value = await pending;
    const writeResult = await runRedis((client) => client.set(key, JSON.stringify(value), 'EX', ttlSeconds));
    if (writeResult) cacheMetrics.writes += 1;
    return { value, cacheStatus: 'miss' };
  } finally {
    inFlight.delete(key);
  }
};

export const invalidateLeadMetricsCaches = async () => {
  await runRedis((client) => client.incr('crm:lead-metrics:version'));
};

const cacheLogIntervalMs = Number(process.env.CACHE_METRICS_LOG_INTERVAL_MS || 0);
if (cacheLogIntervalMs >= 10_000) {
  const timer = setInterval(() => {
    console.info(JSON.stringify({ event: 'cache_metrics', ...getCacheMetrics() }));
  }, cacheLogIntervalMs);
  timer.unref();
}
