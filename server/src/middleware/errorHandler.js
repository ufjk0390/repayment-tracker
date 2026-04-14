import pino from 'pino';

const logger = pino({ name: 'error-handler' });

export function errorHandler(err, req, res, next) {
  logger.error({ err, url: req.url, method: req.method }, 'Unhandled error');

  if (err.code === 'P2002') {
    return res.status(409).json({
      error: {
        code: 'DUPLICATE_ENTRY',
        message: 'A record with this value already exists',
        details: err.meta?.target,
      },
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      error: {
        code: 'RECORD_NOT_FOUND',
        message: 'The requested record was not found',
      },
    });
  }

  const statusCode = err.statusCode || 500;
  const code = err.errorCode || 'INTERNAL_ERROR';
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'An internal server error occurred'
      : err.message || 'An internal server error occurred';

  res.status(statusCode).json({
    error: {
      code,
      message,
    },
  });
}
