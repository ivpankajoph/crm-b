import multer from 'multer';

const imageMimeTypes = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);
const csvMimeTypes = new Set([
  'text/csv',
  'application/csv',
  'text/plain',
  'application/vnd.ms-excel',
]);

export const uploadEmailMarketingImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    callback(
      imageMimeTypes.has(file.mimetype)
        ? null
        : new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname),
      imageMimeTypes.has(file.mimetype),
    );
  },
});

export const uploadEmailMarketingCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const allowed =
      csvMimeTypes.has(file.mimetype) ||
      file.originalname.toLowerCase().endsWith('.csv');
    callback(
      allowed
        ? null
        : new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname),
      allowed,
    );
  },
});
