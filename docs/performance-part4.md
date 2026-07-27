# Part 4 performance rollout

## Safety and rollback

- Keep `MONGO_AUTO_INDEX=false` in production.
- Run `npm run db:indexes:part4` first. This is read-only and prints `executionStats`.
- Review disk headroom and the before-plan before running `npm run db:indexes:part4 -- --apply`.
- The migration creates missing indexes one at a time and never removes an index.
- Set `REPORT_AGGREGATIONS_V2=false` to return Sales and Marketing reports to projected, lean fallback reads.
- Set `RESPONSE_COMPRESSION_ENABLED=false` if the reverse proxy owns compression.
- Set `PERFORMANCE_TIMING_ENABLED=false` to disable API timing middleware.

## Acceptance targets

Use a staging-sized data snapshot and `BENCHMARK_COOKIE` or
`BENCHMARK_AUTHORIZATION` with `npm run benchmark:part4`.

| Endpoint | p95 target |
| --- | ---: |
| `/api/reports/dashboard` | 500 ms |
| Paged Sales/Marketing/User/Meeting report | 750 ms |
| Paginated notification/list endpoint | 500 ms |

For representative indexed queries:

- winning plan must use an index (`IXSCAN` directly or below `FETCH`);
- `totalDocsExamined / nReturned` should normally remain below 10;
- `totalKeysExamined` should remain proportional to the returned/filter range;
- empty-result and low-cardinality queries should be reviewed separately because MongoDB may validly prefer a collection scan.

## Transport checks

- Responses below 1 KB should not be compressed.
- Large JSON/CSV responses should include `Content-Encoding` when the client advertises support.
- `/uploads` is mounted before compression, so already-compressed uploaded files are not recompressed by Express.
- Confirm the reverse proxy does not strip `Vary: Accept-Encoding` or recompress an already encoded response.

## Observability

- Requests slower than `SLOW_REQUEST_THRESHOLD_MS` emit one structured `slow_request` log.
- Logs contain normalized routes and never include query strings, request bodies, cookies, authorization headers, or user IDs.
- `Server-Timing` is emitted for API requests.
- Cache hit/miss/shared/error counters can be logged with `CACHE_METRICS_LOG_INTERVAL_MS`.
- Mongo operation diagnostics are disabled by default and require `MONGO_QUERY_DIAGNOSTICS=true`.
