import { Router } from 'express';
import {
  analyzeRecording,
  createCoachCommentary,
  createNextPractice,
  createWeeklySummary,
} from '../services/aiCoachService.js';

export const coachRouter = Router();

coachRouter.post('/weekly-summary', async (req, res, next) => {
  try {
    res.json(await createWeeklySummary(req.body));
  } catch (error) {
    next(error);
  }
});

coachRouter.post('/analyze-recording', async (req, res, next) => {
  try {
    res.json(await analyzeRecording(req.body));
  } catch (error) {
    next(error);
  }
});

coachRouter.post('/coach-commentary', async (req, res, next) => {
  try {
    res.json(await createCoachCommentary(req.body));
  } catch (error) {
    next(error);
  }
});

coachRouter.post('/next-practice', async (req, res, next) => {
  try {
    res.json(await createNextPractice(req.body));
  } catch (error) {
    next(error);
  }
});
