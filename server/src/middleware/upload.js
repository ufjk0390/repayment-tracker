import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';

const uploadDir = path.resolve('uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uuid = crypto.randomBytes(16).toString('hex');
    cb(null, `${uuid}${ext}`);
  },
});

const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];

function fileFilter(req, file, cb) {
  if (!allowedMimes.includes(file.mimetype)) {
    return cb(new Error('Only jpg, png, pdf files are allowed'));
  }
  cb(null, true);
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});
