import cors from 'cors';
import express, { ErrorRequestHandler } from 'express';
import { config } from './config.js';
import { coachRouter } from './routes/coach.js';
import { scriptsRouter } from './routes/scripts.js';
import { summaryRouter } from './routes/summary.js';
import { transcriptionRouter } from './routes/transcription.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'voice-coach-ai-service',
    provider: config.provider,
    textModel: config.textModel,
    textModels: config.textModels,
    transcribeModel: config.transcribeModel,
  });
});

app.use('/ai', coachRouter);
app.use('/ai', scriptsRouter);
app.use('/ai', transcriptionRouter);
app.use('/ai', summaryRouter);

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const status = error?.name === 'MissingApiKeyError' ? 503 : 500;
  res.status(status).json({
    error: status === 503 ? 'AI service is not configured' : 'AI service temporarily unavailable',
    message: 'AI 服务暂时不可用，本地训练推荐仍可正常使用。',
  });
};

app.use(errorHandler);

app.listen(config.port, '0.0.0.0', () => {
  console.log(`voice-coach-ai-service listening on ${config.port}`);
});
