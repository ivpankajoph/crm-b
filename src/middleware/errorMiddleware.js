import { errorResponse } from '../utils/response.js';

export const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

export const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  // Handle Mongoose Bad ObjectId
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    message = 'Resource not found';
    statusCode = 404;
  }

  // Handle Zod Validation Errors
  if (err.name === 'ZodError') {
    const errors = err.errors.map(e => ({ field: e.path.join('.'), message: e.message }));
    return errorResponse(res, 400, 'Validation Error', errors);
  }

  errorResponse(res, statusCode, message, process.env.NODE_ENV === 'production' ? null : err.stack);
};
