import { promises as fs } from 'node:fs';
import { Router } from 'express';
import multer from 'multer';
import { transcribeFile } from '../services/transcriptionService.js';

const upload = multer({ dest: 'uploads/', limits: { fileSize: 30 * 1024 * 1024 } });

export const transcriptionRouter = Router();

transcriptionRouter.post('/transcribe', upload.single('audio'), async (req, res, next) => {
  const filePath = req.file?.path;
  if (!filePath) {
    res.status(400).json({ error: 'audio file is required' });
    return;
  }

  try {
    res.json(await transcribeFile(filePath));
  } catch (error) {
    next(error);
  } finally {
    await fs.rm(filePath, { force: true }).catch(() => undefined);
  }
});
