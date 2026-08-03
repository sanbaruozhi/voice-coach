import { FocusPreference, TrainingCategory } from '../types';

const focusToCategory: Partial<Record<FocusPreference, TrainingCategory>> = {
  breath: 'breath',
  resonance: 'resonance',
  tone: 'tone',
  articulation: 'articulation',
};

export function scoreCategory(input: {
  category: TrainingCategory;
  daysSinceCategoryPracticed: number;
  weaknessScore: number;
  stageMatchScore: number;
  focusPreference: FocusPreference;
  recentBalanceScore: number;
  throatRiskPenalty: number;
}) {
  const focusPreferenceScore = focusToCategory[input.focusPreference] === input.category ? 1 : 0;
  return (
    input.daysSinceCategoryPracticed * 0.25 +
    input.weaknessScore * 0.3 +
    input.stageMatchScore * 0.2 +
    focusPreferenceScore * 0.15 +
    input.recentBalanceScore * 0.1 -
    input.throatRiskPenalty
  );
}

export function stageMatch(category: TrainingCategory, stage: 1 | 2 | 3 | 4) {
  if (stage === 1) return ['relax', 'breath', 'sovt'].includes(category) ? 1 : 0.2;
  if (stage === 2) return category === 'resonance' ? 1 : ['relax', 'breath', 'sovt'].includes(category) ? 0.6 : 0.2;
  if (stage === 3) return ['tone', 'articulation'].includes(category) ? 1 : category === 'resonance' ? 0.6 : 0.2;
  return ['scenario', 'tone', 'articulation'].includes(category) ? 1 : 0.4;
}
