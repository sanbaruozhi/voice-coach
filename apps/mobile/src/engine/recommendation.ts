import { moduleById } from '../data/trainingModules';
import { sessionTemplates, templateById } from '../data/sessionTemplates';
import { FocusPreference, RecommendationInput, RecommendationResult, TrainingCategory } from '../types';
import { safetyNoticeForStatus } from './safetyRules';
import { scoreCategory, stageMatch } from './scoring';
import { stageForDaysSinceLastSession } from './stageRules';

const focusTemplate: Partial<Record<FocusPreference, string>> = {
  breath: 'breath-5',
  resonance: 'resonance-5',
  tone: 'tone-5',
  articulation: 'tone-5',
  review: 'standard-10',
};

const categoryTemplates: Partial<Record<TrainingCategory, string>> = {
  breath: 'breath-5',
  resonance: 'resonance-5',
  tone: 'tone-5',
  articulation: 'tone-5',
  scenario: 'standard-10',
  relax: 'tired-recovery-3',
  sovt: 'tired-recovery-3',
};

function fitTemplateToMinutes(templateId: string, minutes: 3 | 5 | 10 | 20) {
  if (minutes === 20) return 'complete-20';
  if (minutes === 10 && templateId !== 'pre-meeting-3' && templateId !== 'silent-3') return 'standard-10';
  if (minutes === 3) {
    if (templateId === 'pre-meeting-3' || templateId === 'silent-3') return templateId;
    return 'tired-recovery-3';
  }
  return templateId;
}

function buildResult(templateId: string, reason: string, input: RecommendationInput): RecommendationResult {
  const template = templateById[templateId] ?? templateById['standard-10'];
  const safetyNotice = safetyNoticeForStatus(input.currentStatus);
  return {
    sessionTemplateId: template.id,
    sessionName: template.name,
    focusGoal: template.goal,
    recommendationReason: reason,
    moduleIds: template.moduleIds,
    safetyNotice,
    shouldOfferAiReview: input.focusPreference === 'review' || template.durationMin >= 10,
  };
}

function categoryCoverageScore(input: RecommendationInput) {
  const practicedCategories = new Set(
    input.recentModules.map((id) => moduleById[id]?.category).filter(Boolean) as TrainingCategory[]
  );

  const categories: TrainingCategory[] = ['breath', 'resonance', 'tone', 'articulation', 'scenario'];
  const effectiveStage = stageForDaysSinceLastSession(input.currentStage, input.daysSinceLastSession);

  return categories
    .map((category) => {
      const missing = practicedCategories.has(category) ? 0 : 1;
      const weak = input.weakCategories.includes(category) ? 1 : 0;
      return {
        category,
        score: scoreCategory({
          category,
          daysSinceCategoryPracticed: missing ? 4 : 1,
          weaknessScore: weak,
          stageMatchScore: stageMatch(category, effectiveStage),
          focusPreference: input.focusPreference,
          recentBalanceScore: missing,
          throatRiskPenalty: input.currentStatus === 'tired' && !['breath', 'relax'].includes(category) ? 0.6 : 0,
        }),
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function recommendSession(input: RecommendationInput): RecommendationResult {
  if (input.currentStatus === 'tired') {
    return buildResult(
      'tired-recovery-3',
      '今天不建议做强发声训练。先做 3 分钟护嗓恢复包，让喉咙轻松下来。',
      input
    );
  }

  if (input.currentStatus === 'silent') {
    return buildResult('silent-3', '当前不方便出声，先做不出声训练，维护气息和身体状态。', input);
  }

  if (input.currentStatus === 'preMeeting') {
    return buildResult(
      'pre-meeting-3',
      '现在适合做会议前热身。目标不是练新东西，而是让开口更稳，句尾更落。',
      input
    );
  }

  if (input.daysSinceLastSession !== null && input.daysSinceLastSession >= 8) {
    return buildResult(
      fitTemplateToMinutes('tired-recovery-3', input.availableMinutes),
      `你已经 ${input.daysSinceLastSession} 天没练了。不用补课，今天先恢复手感，做低强度的放松、气息和轻哼。`,
      input
    );
  }

  if (input.daysSinceLastSession !== null && input.daysSinceLastSession >= 4) {
    return buildResult(
      fitTemplateToMinutes('breath-5', input.availableMinutes),
      `你已经 ${input.daysSinceLastSession} 天没练了。今天不推进新内容，先恢复气息和轻松发声。`,
      input
    );
  }

  const preferredTemplate = focusTemplate[input.focusPreference];
  if (preferredTemplate) {
    const finalId = fitTemplateToMinutes(preferredTemplate, input.availableMinutes);
    const template = templateById[finalId];
    return buildResult(
      finalId,
      `你选择了本次偏重，且不违反安全规则。今天建议做 ${template.name}，本次只抓一个目标：${template.goal}`,
      input
    );
  }

  if (input.availableMinutes === 20) {
    return buildResult('complete-20', '今天时间充足，建议做完整训练，但仍以省力、清楚、稳定为边界。', input);
  }

  if (input.availableMinutes === 10) {
    return buildResult('standard-10', '今天适合做一次标准闭环：热身、主训练、短句迁移和自评。', input);
  }

  const bestCategory = categoryCoverageScore(input)[0]?.category ?? 'breath';
  const templateId = fitTemplateToMinutes(categoryTemplates[bestCategory] ?? 'breath-5', input.availableMinutes);
  const template = templateById[templateId];
  const weakText = input.weakCategories.includes(bestCategory) ? '，也是最近的薄弱项' : '';
  return buildResult(
    templateId,
    `你最近 ${bestCategory} 练得相对少${weakText}。今天建议做 ${template.name}，本次只抓一个目标：${template.goal}`,
    input
  );
}

export function getDefaultRecommendation(): RecommendationResult {
  return recommendSession({
    availableMinutes: 5,
    currentStatus: 'normal',
    focusPreference: 'appDecides',
    daysSinceLastSession: null,
    recentSessions: [],
    recentModules: [],
    averageScores: {},
    weakCategories: [],
    currentStage: 1,
  });
}

export function allRecommendationTemplates() {
  return sessionTemplates;
}
