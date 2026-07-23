import { errorResponse } from '../../../utils/response.js';

export const validateEmailMarketingRequest = (schema) => (req, res, next) => {
  const result = schema.safeParse({
    body: req.body,
    query: req.query,
    params: req.params,
  });

  if (!result.success) {
    return errorResponse(
      res,
      400,
      'Validation Error',
      result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }

  req.validated = result.data;
  return next();
};
