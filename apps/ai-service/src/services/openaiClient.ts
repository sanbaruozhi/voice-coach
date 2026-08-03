import OpenAI from 'openai';
import { config, requireAiKey } from '../config.js';

export function createDashScopeClient() {
  return new OpenAI({
    apiKey: requireAiKey(),
    baseURL: config.dashScopeBaseUrl,
  });
}
