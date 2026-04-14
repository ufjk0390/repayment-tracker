import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = Router();

router.post('/', authenticate, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        error: {
          code: 'UPLOAD_ERROR',
          message: err.message,
        },
      });
    }
    if (!req.file) {
      return res.status(400).json({
        error: { code: 'NO_FILE', message: 'No file uploaded' },
      });
    }
    res.status(201).json({
      data: {
        filename: req.file.filename,
        url: `/uploads/${req.file.filename}`,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  });
});

export default router;
