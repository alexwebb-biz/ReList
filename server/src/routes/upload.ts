import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../middleware/auth.js';
import { uploadFile, getUploadUrl, getPublicUrl, deleteFile } from '../config/s3.js';
import { success, error } from '../utils/response.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'));
    }
  },
});

// Get presigned upload URL (for direct client upload)
router.get('/presigned-url', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { filename, contentType } = req.query;

    if (!filename || !contentType) {
      return res.status(400).json(error('MISSING_PARAMS', 'filename and contentType are required'));
    }

    const userId = req.user!.id;
    const ext = (filename as string).split('.').pop() || 'jpg';
    const key = `uploads/${userId}/${uuidv4()}.${ext}`;

    const uploadUrl = await getUploadUrl(key, contentType as string);
    const publicUrl = getPublicUrl(key);

    res.json(success({
      uploadUrl,
      publicUrl,
      key,
    }));
  } catch (err) {
    console.error('Error generating presigned URL:', err);
    res.status(500).json(error('UPLOAD_ERROR', 'Failed to generate upload URL'));
  }
});

// Direct file upload
router.post('/image', authenticateToken, upload.single('image'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json(error('NO_FILE', 'No image file provided'));
    }

    const userId = req.user!.id;
    const ext = req.file.originalname.split('.').pop() || 'jpg';
    const key = `uploads/${userId}/${uuidv4()}.${ext}`;

    await uploadFile(key, req.file.buffer, req.file.mimetype);

    const publicUrl = getPublicUrl(key);

    res.json(success({
      url: publicUrl,
      key,
      size: req.file.size,
      mimetype: req.file.mimetype,
    }));
  } catch (err) {
    console.error('Error uploading file:', err);
    res.status(500).json(error('UPLOAD_ERROR', 'Failed to upload file'));
  }
});

// Upload multiple images
router.post('/images', authenticateToken, upload.array('images', 10), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json(error('NO_FILES', 'No image files provided'));
    }

    const userId = req.user!.id;
    const uploadedFiles = [];

    for (const file of files) {
      const ext = file.originalname.split('.').pop() || 'jpg';
      const key = `uploads/${userId}/${uuidv4()}.${ext}`;

      await uploadFile(key, file.buffer, file.mimetype);

      uploadedFiles.push({
        url: getPublicUrl(key),
        key,
        size: file.size,
        mimetype: file.mimetype,
        originalName: file.originalname,
      });
    }

    res.json(success({
      files: uploadedFiles,
      count: uploadedFiles.length,
    }));
  } catch (err) {
    console.error('Error uploading files:', err);
    res.status(500).json(error('UPLOAD_ERROR', 'Failed to upload files'));
  }
});

// Delete an uploaded file
router.delete('/:key', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { key } = req.params;
    const userId = req.user!.id;

    // Verify the file belongs to this user
    if (!key.includes(`uploads/${userId}/`)) {
      return res.status(403).json(error('FORBIDDEN', 'You can only delete your own files'));
    }

    await deleteFile(key);

    res.json(success({ deleted: true }));
  } catch (err) {
    console.error('Error deleting file:', err);
    res.status(500).json(error('DELETE_ERROR', 'Failed to delete file'));
  }
});

export default router;
