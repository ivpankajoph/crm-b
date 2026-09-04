import 'dotenv/config';
import { performance } from 'node:perf_hooks';

const baseUrl = String(process.env.BENCHMARK_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const cookie = String(process.env.BENCHMARK_COOKIE || '');
const authorization = String(process.env.BENCHMARK_AUTHORIZATION || '');
const iterations = Math.min(Math.max(Number(process.env.BENCHMARK_ITERATIONS || 10), 2), 100);
const endpoints = String(process.env.BENCHMARK_ENDPOINTS || [
  '/api/reports/dashboard',
  '/api/reports/sales?page=1&limit=50',
  '/api/reports/users?page=1&limit=50',
  '/api/reports/meetings?page=1&limit=50',
  '/api/notifications/paged?page=1&limit=25',
].join(',')).split(',').map((value) => value.trim()).filter(Boolean);

const percentile = (values, ratio) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
};

const request = async (endpoint) => {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(authorization ? { authorization } : {}),
      'accept-encoding': 'gzip, deflate',
    },
  });
  await response.arrayBuffer();
  return {
    status: response.status,
    durationMs: Number((performance.now() - startedAt).toFixed(1)),
    contentEncoding: response.headers.get('content-encoding') || 'identity',
  };
};

const report = [];
for (const endpoint of endpoints) {
  await request(endpoint);
  const samples = [];
  const statuses = new Set();
  const encodings = new Set();
  for (let index = 0; index < iterations; index += 1) {
    const sample = await request(endpoint);
    samples.push(sample.durationMs);
    statuses.add(sample.status);
    encodings.add(sample.contentEncoding);
  }
  report.push({
    endpoint,
    iterations,
    statuses: [...statuses],
    encodings: [...encodings],
    minMs: Math.min(...samples),
    medianMs: percentile(samples, 0.5),
    p95Ms: percentile(samples, 0.95),
    maxMs: Math.max(...samples),
  });
}

console.log(JSON.stringify({ baseUrl, generatedAt: new Date().toISOString(), report }, null, 2));
