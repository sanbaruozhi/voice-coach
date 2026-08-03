import { config } from '../config.js';
import {
  CoachCommentaryResponse,
  GenerateScriptResponse,
  NextPracticeResponse,
  RecordingAnalysisResponse,
  WeeklySummaryResponse,
} from '../types/coach.js';
import { enforceSafetyCaution, hasThroatRiskText } from './safetyFilter.js';
import { createDashScopeClient } from './openaiClient.js';
import {
  coachCommentaryPrompt,
  coachSystemPrompt,
  nextPracticePrompt,
  recordingAnalysisPrompt,
  scriptPrompt,
  weeklySummaryPrompt,
} from './promptTemplates.js';

const weeklyFallback: WeeklySummaryResponse = {
  summary: '本周训练记录较少，先保持低压力恢复。',
  progress: ['已经开始建立训练记录。'],
  weaknesses: ['数据还不够多，暂不判断长期短板。'],
  likelyReasons: ['训练样本不足，建议继续积累 3-5 次记录。'],
  nextWeekFocus: '放松、气息和轻哼，先让声音省力。',
  actionItems: ['每次只抓一个目标。', '嗓子累时只做恢复训练。', '练后记录喉咙轻松度。'],
  reminder: '不用补课，先恢复手感。',
};

const recoveryFallback: NextPracticeResponse = {
  id: 'ai-safe-recovery',
  title: '3 分钟嗓音恢复',
  minutes: 3,
  goal: '先让喉咙轻松，不追求音色。',
  reason: '当前反馈里有嗓音疲劳或风险信号，先降低强度。',
  source: 'local',
  steps: [
    {
      id: 'release',
      title: '肩颈放松',
      seconds: 60,
      cue: '肩膀下沉，喉咙没有顶住的感觉。',
      instruction: '1. 坐直或站稳，肩膀自然落下。\n2. 头轻轻左右转动，不绕大圈。\n3. 嘴唇轻闭，牙关放松。\n4. 只做放松，不急着发声。',
    },
    {
      id: 'breath',
      title: '低位呼吸',
      seconds: 60,
      cue: '吸气不耸肩，呼气不断线。',
      instruction: '1. 鼻吸 2 秒，腰腹轻轻撑开。\n2. 嘴巴慢慢呼 4 秒。\n3. 胸口不往上顶，喉咙不参与用力。\n4. 做到舒服即可，不要憋气。',
    },
    {
      id: 'hum',
      title: '闭口轻哼',
      seconds: 60,
      cue: '唇边微微振动，音量很小。',
      instruction: '1. 如果喉咙不疼，再做这一步。\n2. 闭口轻轻发“嗯——”，音量只要自己听见。\n3. 每次 3 秒，停 2 秒。\n4. 一紧就停，改为安静呼吸。',
    },
  ],
};

const defaultNextPractice: NextPracticeResponse = {
  id: 'ai-first-breath',
  title: '5 分钟气息稳定',
  minutes: 5,
  goal: '先建立省力、不断线的开口基础。',
  reason: '历史训练样本还不多，下一练先从低风险的气息和短句稳定开始。',
  source: 'local',
  steps: [
    {
      id: 'posture',
      title: '姿态归位',
      seconds: 60,
      cue: '胸口不顶，后背展开。',
      instruction: '1. 坐直但不要僵，脚掌踩实。\n2. 下巴微收，眼睛看正前方。\n3. 肩膀自然落下，牙关放松。\n4. 先无声呼吸两轮再开口。',
    },
    {
      id: 'flow',
      title: '均匀气流',
      seconds: 120,
      cue: '气流细、长、不断。',
      instruction: '1. 鼻吸 2 秒，不吸满。\n2. 轻吐“s——”，像慢慢放气。\n3. 每次还剩一点气就停，不硬撑。\n4. 重点听气流是否平稳。',
    },
    {
      id: 'sentence',
      title: '单句稳定',
      seconds: 120,
      cue: '开头不冲，句尾不虚。',
      instruction: '1. 练句：今天我们先把这个问题说清楚。\n2. 第一遍小声读，确认不挤。\n3. 第二遍正常音量，句尾落住。\n4. 第三遍换成你自己的工作句。',
    },
  ],
};

function parseJson<T>(content: string): T | null {
  try {
    const trimmed = content.trim().replace(/^```json\s*/i, '').replace(/```$/i, '');
    return JSON.parse(trimmed) as T;
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<{ ok: true; value: T } | { ok: false }> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false }), ms);
    promise
      .then((value) => resolve({ ok: true, value }))
      .catch(() => resolve({ ok: false }))
      .finally(() => clearTimeout(timer));
  });
}

async function completeJson<T>(userPrompt: string, fallback: T): Promise<T> {
  const client = createDashScopeClient();
  for (const model of config.textModels) {
    const response = await withTimeout(
      client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: coachSystemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.35,
        max_completion_tokens: 2200,
        enable_thinking: false,
      } as never),
      config.textTimeoutMs
    );
    if (!response.ok) continue;
    const parsed = parseJson<T>(response.value.choices[0]?.message?.content ?? '');
    if (parsed) return parsed;
  }
  return fallback;
}

export async function createWeeklySummary(payload: unknown): Promise<WeeklySummaryResponse> {
  const sessions = (payload as { sessions?: unknown[] } | null)?.sessions;
  if (Array.isArray(sessions) && sessions.length === 0) {
    return weeklyFallback;
  }
  const raw = await completeJson<any>(weeklySummaryPrompt(payload), weeklyFallback);
  return {
    summary: raw.summary ?? raw['本周训练概况'] ?? weeklyFallback.summary,
    progress: normalizeList(raw.progress ?? raw['进步点'], weeklyFallback.progress),
    weaknesses: normalizeList(raw.weaknesses ?? raw['主要短板'], weeklyFallback.weaknesses),
    likelyReasons: normalizeList(raw.likelyReasons ?? raw['可能原因'], weeklyFallback.likelyReasons),
    nextWeekFocus: raw.nextWeekFocus ?? raw['下周训练重点'] ?? weeklyFallback.nextWeekFocus,
    actionItems: normalizeList(raw.actionItems ?? raw['具体建议'] ?? raw['3个具体建议'], weeklyFallback.actionItems),
    reminder: raw.reminder ?? raw['提醒'] ?? raw['一句提醒'] ?? weeklyFallback.reminder,
  };
}

function normalizeList(value: unknown, fallback: string[]) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return fallback;
}

export async function createScripts(payload: unknown): Promise<GenerateScriptResponse> {
  const fallback: GenerateScriptResponse = {
    scripts: [
      {
        title: '稳声汇报练习',
        text: '领导，我简要汇报三点。第一，目前这项工作总体可控。第二，主要风险在于口径是否统一。第三，我建议今天先把基础材料补齐，明天形成正式意见。',
        practiceTips: ['第一句前停半拍。', '每个序号后略降速。', '句尾收住，不急着接下一句。'],
      },
    ],
  };
  const raw = await completeJson<any>(scriptPrompt(payload), fallback);
  const scripts = Array.isArray(raw?.scripts)
    ? raw.scripts
    : raw?.script
      ? [{ title: raw.title ?? '训练稿 1', text: raw.script, practiceTips: raw.practiceTips ?? [] }]
      : fallback.scripts;
  while (scripts.length < 3) {
    const source = scripts[0] ?? fallback.scripts[0];
    scripts.push({
      title: `训练稿 ${scripts.length + 1}`,
      text: source.text,
      practiceTips: source.practiceTips?.length
        ? source.practiceTips
        : ['第一句前停半拍。', '关键词稍慢。', '句尾落住后再接下一句。'],
    });
  }
  return {
    scripts: scripts.slice(0, 3).map((item: any, index: number) => ({
      title: item.title ?? `训练稿 ${index + 1}`,
      text: item.text ?? item.script ?? '',
      practiceTips: Array.isArray(item.practiceTips) ? item.practiceTips : [],
    })),
  };
}

export async function analyzeRecording(payload: unknown): Promise<RecordingAnalysisResponse> {
  const result = await completeJson<RecordingAnalysisResponse>(recordingAnalysisPrompt(payload), {
    summary: '这次录音可以作为一次基础复盘，重点先看表达结构和句尾稳定。',
    strengths: ['完成了录音复盘。'],
    issues: ['AI 没有拿到足够稳定的结构化反馈。'],
    specificAdvice: ['下次录音控制在 45-90 秒。', '先读固定训练稿。', '练完记录喉咙轻松度。'],
    nextPractice: {
      focus: '句尾落住',
      recommendedSession: '5分钟稳重语气包',
      reason: '先用短句把稳定感找回来。',
    },
    caution: 'AI 不做医学诊断；如嗓子疼或明显嘶哑，请停止发声训练。',
  });
  return enforceSafetyCaution(result, payload);
}

export async function createCoachCommentary(payload: unknown): Promise<CoachCommentaryResponse> {
  return completeJson<CoachCommentaryResponse>(coachCommentaryPrompt(payload), {
    coachMessage: '今天按本地推荐练就可以，重点放在省力和稳定。',
    oneThingToWatch: '句尾不要急着掉下去。',
    afterPracticeQuestion: '练完后，喉咙是否比开始前更轻松？',
  });
}

export async function createNextPractice(payload: unknown): Promise<NextPracticeResponse> {
  const fallback = hasThroatRiskText(payload) ? recoveryFallback : defaultNextPractice;
  const raw = await completeJson<any>(nextPracticePrompt(payload), fallback);
  return normalizeNextPractice(raw, fallback);
}

function normalizeNextPractice(raw: any, fallback: NextPracticeResponse): NextPracticeResponse {
  const minutes = Math.min(20, Math.max(3, Number(raw?.minutes ?? fallback.minutes)));
  const steps = Array.isArray(raw?.steps)
    ? raw.steps
        .slice(0, 5)
        .map((step: any, index: number) => ({
          id: String(step?.id ?? `step-${index + 1}`),
          title: String(step?.title ?? fallback.steps[index]?.title ?? `第 ${index + 1} 步`),
          seconds: Math.max(30, Math.min(600, Number(step?.seconds ?? fallback.steps[index]?.seconds ?? 60))),
          cue: String(step?.cue ?? fallback.steps[index]?.cue ?? '保持轻松、稳定、不挤。'),
          instruction: String(step?.instruction ?? fallback.steps[index]?.instruction ?? ''),
        }))
        .filter((step: any) => step.title.trim() && step.instruction.trim().length >= 20)
    : [];

  if (steps.length < 2 || containsUnsafePlanText(raw)) {
    return fallback;
  }

  return {
    id: String(raw?.id ?? fallback.id),
    title: String(raw?.title ?? fallback.title),
    minutes,
    goal: String(raw?.goal ?? fallback.goal),
    reason: String(raw?.reason ?? fallback.reason),
    source: 'ai',
    steps,
  };
}

function containsUnsafePlanText(value: unknown) {
  const text = JSON.stringify(value ?? '');
  return ['疼痛时坚持', '嘶哑时继续', '大声喊', '用力吼', '憋到极限', '强行压低'].some((word) =>
    text.includes(word)
  );
}
