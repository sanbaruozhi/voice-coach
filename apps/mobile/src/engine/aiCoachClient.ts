import { NativeModules, Platform } from 'react-native';
import {
  readConfiguredAiServiceBaseUrl,
  setAiServiceBaseUrl as writeBaseUrl,
} from '../db/settingsRepo';

export const AI_FALLBACK_MESSAGE = 'AI 服务暂时不可用，本地训练推荐仍可正常使用。';

function hostFromUrl(value?: string | null) {
  if (!value) return null;
  const match = value.match(/^(?:https?|exp):\/\/([^/:]+)/);
  return match?.[1] ?? null;
}

function getRuntimeAiServiceBaseUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `http://${window.location.hostname || 'localhost'}:8787`;
  }

  const scriptUrl = NativeModules.SourceCode?.scriptURL as string | undefined;
  const host = hostFromUrl(scriptUrl);
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:8787`;
  }

  return 'http://localhost:8787';
}

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = await readAiServiceBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(AI_FALLBACK_MESSAGE);
  }
  return response.json() as Promise<T>;
}

export function readAiServiceBaseUrl() {
  return readConfiguredAiServiceBaseUrl().then((value) => value ?? getRuntimeAiServiceBaseUrl());
}

export function setAiServiceBaseUrl(value: string) {
  return writeBaseUrl(value);
}

export async function checkAiServiceHealth() {
  return requestJson<{
    ok: boolean;
    service: string;
    provider?: string;
    textModel?: string;
    transcribeModel?: string;
  }>('/health');
}

export function getWeeklySummary(payload: unknown) {
  return requestJson<{
    summary: string;
    progress: string[];
    weaknesses: string[];
    likelyReasons: string[];
    nextWeekFocus: string;
    actionItems: string[];
    reminder: string;
  }>('/ai/weekly-summary', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function generateScript(payload: unknown) {
  return requestJson<{ scripts: Array<{ title: string; text: string; practiceTips: string[] }> }>('/ai/generate-script', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function analyzeRecording(payload: unknown) {
  return requestJson<{
    summary: string;
    strengths: string[];
    issues: string[];
    specificAdvice: string[];
    nextPractice: { focus: string; recommendedSession: string; reason: string };
    caution: string;
  }>('/ai/analyze-recording', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getCoachCommentary(payload: unknown) {
  return requestJson<{
    coachMessage: string;
    oneThingToWatch: string;
    afterPracticeQuestion: string;
  }>('/ai/coach-commentary', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function transcribeRecording(fileUri: string) {
  const form = new FormData();
  form.append('audio', {
    uri: fileUri,
    name: fileUri.split('/').pop() ?? 'recording.m4a',
    type: 'audio/mp4',
  } as unknown as Blob);
  return requestJson<{ transcript: string; durationSec: number }>('/ai/transcribe', {
    method: 'POST',
    body: form,
  });
}
