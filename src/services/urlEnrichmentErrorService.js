const statusOf = (error) => Number(
  error?.statusCode
  || error?.status
  || error?.response?.status
  || (typeof error?.code === 'number' ? error.code : 0),
);

export const toPublicUrlEnrichmentError = (error) => {
  const status = statusOf(error);
  const code = String(error?.code || error?.status || error?.response?.data?.error?.status || '');
  const message = String(error?.message || '');

  // URL validation errors are already written for end users.
  if (status === 400 && !/api key|gemini|model|permission/i.test(message)) {
    return Object.assign(new Error(message || 'Please enter a valid website URL'), {
      statusCode: 400,
    });
  }

  if (
    status === 429
    || code === 'RESOURCE_EXHAUSTED'
    || /rate limit|quota|resource exhausted/i.test(message)
  ) {
    return Object.assign(new Error(
      'Website import is currently busy. Please wait a moment and try again.',
    ), { statusCode: 429 });
  }

  if (
    status === 401
    || status === 403
    || status === 404
    || /api key|gemini|model|permission.denied|denied access|billing|dunning/i.test(message)
  ) {
    return Object.assign(new Error(
      'Website import service is temporarily unavailable. Please enter the details manually or contact your administrator.',
    ), { statusCode: 503 });
  }

  if (
    status === 422
    || ['ERR_BAD_REQUEST', 'ERR_BAD_RESPONSE', 'ECONNABORTED', 'ETIMEDOUT'].includes(code)
    || /timed out|timeout|unable to fetch|could not be scanned|did not return an html/i.test(message)
  ) {
    return Object.assign(new Error(
      'We could not access this website. Please check the URL and make sure the website is publicly available.',
    ), { statusCode: 422 });
  }

  return Object.assign(new Error(
    'Something went wrong while importing website details. Please try again.',
  ), { statusCode: 502 });
};
