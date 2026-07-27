const diagnosticsAllowed = () => {
  const enabled = String(process.env.MONGO_QUERY_DIAGNOSTICS || '').toLowerCase() === 'true';
  if (!enabled) return false;
  if (process.env.NODE_ENV !== 'production') return true;
  return String(process.env.ALLOW_PRODUCTION_MONGO_DIAGNOSTICS || '').toLowerCase() === 'true';
};

export const summarizeExplain = (explain = {}) => {
  const stats = explain.executionStats || {};
  return {
    executionTimeMillis: stats.executionTimeMillis ?? null,
    totalDocsExamined: stats.totalDocsExamined ?? null,
    totalKeysExamined: stats.totalKeysExamined ?? null,
    returned: stats.nReturned ?? null,
    winningPlan: explain.queryPlanner?.winningPlan?.stage
      || explain.queryPlanner?.winningPlan?.queryPlan?.stage
      || null,
  };
};

export const configureMongoDiagnostics = (mongoose) => {
  if (!diagnosticsAllowed()) return false;
  mongoose.set('debug', (collection, method) => {
    console.debug(JSON.stringify({
      event: 'mongo_operation',
      collection,
      method,
    }));
  });
  return true;
};

export const explainQuery = async (query, label) => {
  if (!diagnosticsAllowed()) {
    throw new Error('Mongo query diagnostics are disabled');
  }
  const explain = await query.explain('executionStats');
  const summary = summarizeExplain(explain);
  console.info(JSON.stringify({ event: 'mongo_explain', label, ...summary }));
  return summary;
};
