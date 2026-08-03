import { Router } from 'express';

export const summaryRouter = Router();

summaryRouter.get('/privacy-boundary', (_req, res) => {
  res.json({
    aiCan: ['解释训练记录', '总结趋势', '生成训练稿', '分析转写文本'],
    aiCannot: ['覆盖本地安全规则', '做医学诊断', '要求带病强练', '默认保存录音'],
  });
});
