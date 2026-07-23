import multer from 'multer';

import { errorResponse } from '../../../utils/response.js';

export const emailMarketingErrorHandler = (error, _req, res, next) => {
  if (res.headersSent) return next(error);

  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'Upload exceeds the 5 MB limit'
        : 'Invalid or unsupported upload';
    return errorResponse(res, 400, message);
  }

  if (error?.code === 11000) {
    const field = Object.keys(error.keyPattern || error.keyValue || {})[0];
    return errorResponse(
      res,
      409,
      field ? `A record with this ${field} already exists` : 'Duplicate record',
    );
  }

  if (error?.name === 'ValidationError') {
    const errors = Object.entries(error.errors || {}).map(([field, value]) => ({
      field,
      message: value.message,
    }));
    return errorResponse(res, 400, 'Validation Error', errors);
  }

  return next(error);
};
