import { Router } from 'express';
import { createScripts } from '../services/aiCoachService.js';

export const scriptsRouter = Router();

scriptsRouter.post('/generate-script', async (req, res, next) => {
  try {
    res.json(await createScripts(req.body));
  } catch (error) {
    next(error);
  }
});
