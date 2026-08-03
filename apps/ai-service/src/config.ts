import dotenv from 'dotenv';

dotenv.config({ path: new URL('../.env', import.meta.url) });

export type AppConfig = {
  provider: 'dashscope';
  dashScopeApiKey?: string;
  dashScopeBaseUrl: string;
  textModel: string;
  textModels: string[];
  textTimeoutMs: number;
  transcribeModel: string;
  port: number;
};

function parseModelList() {
  const raw = process.env.QWEN_TEXT_MODELS ?? process.env.QWEN_TEXT_MODEL;
  const models = raw
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return models?.length ? models : ['qwen3.7-max', 'qwen3.7-plus', 'qwen-plus'];
}

const textModels = parseModelList();

export const config: AppConfig = {
  provider: 'dashscope',
  dashScopeApiKey: process.env.DASHSCOPE_API_KEY,
  dashScopeBaseUrl:
    process.env.DASHSCOPE_BASE_URL ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  textModel: textModels[0] ?? 'qwen3.7-max',
  textModels,
  textTimeoutMs: Number(process.env.QWEN_TEXT_TIMEOUT_MS ?? 30_000),
  transcribeModel: process.env.DASHSCOPE_TRANSCRIBE_MODEL ?? 'qwen3-asr-flash',
  port: Number(process.env.PORT ?? 8787),
};

export function requireAiKey() {
  if (!config.dashScopeApiKey) {
    const error = new Error('AI service is not configured.');
    error.name = 'MissingApiKeyError';
    throw error;
  }
  return config.dashScopeApiKey;
}
