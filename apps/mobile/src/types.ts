export type TrainingCategory =
  | 'relax'
  | 'breath'
  | 'sovt'
  | 'resonance'
  | 'articulation'
  | 'tone'
  | 'scenario';

export type TrainingModule = {
  id: string;
  name: string;
  category: TrainingCategory;
  level: 1 | 2 | 3 | 4;
  durationSec: number;
  intensity: 'low' | 'medium' | 'high';
  requiresVoice: boolean;
  requiresRecording: boolean;
  suitableWhenTired: boolean;
  goal: string;
  instruction: string[];
  visualCue: string;
  commonMistakes: string[];
  successCriteria: string[];
  exampleText?: string[];
  demoAudioUri?: string;
  tags: string[];
};

export type SessionTemplate = {
  id: string;
  name: string;
  durationMin: 3 | 5 | 10 | 20;
  goal: string;
  moduleIds: string[];
  reasonHint: string;
  statusFit?: Array<'normal' | 'tired' | 'silent' | 'preMeeting'>;
};

export type CurrentStatus = 'normal' | 'tired' | 'silent' | 'preMeeting';
export type FocusPreference =
  | 'appDecides'
  | 'breath'
  | 'resonance'
  | 'tone'
  | 'articulation'
  | 'review';

export type AverageScores = {
  throatEase?: number;
  voiceStability?: number;
  resonanceForward?: number;
  sentenceEnding?: number;
  naturalness?: number;
  difficulty?: number;
};

export type TrainingSession = {
  id: string;
  started_at: string;
  completed_at?: string | null;
  planned_duration_min: number;
  actual_duration_sec?: number | null;
  session_type: string;
  completed: number;
  throat_status_before?: string | null;
  throat_status_after?: string | null;
  recommendation_reason: string;
  focus_goal: string;
  notes?: string | null;
};

export type RecommendationInput = {
  availableMinutes: 3 | 5 | 10 | 20;
  currentStatus: CurrentStatus;
  focusPreference: FocusPreference;
  daysSinceLastSession: number | null;
  recentSessions: TrainingSession[];
  recentModules: string[];
  averageScores: AverageScores;
  weakCategories: TrainingCategory[];
  currentStage: 1 | 2 | 3 | 4;
};

export type RecommendationResult = {
  sessionTemplateId: string;
  sessionName: string;
  focusGoal: string;
  recommendationReason: string;
  moduleIds: string[];
  safetyNotice?: string;
  shouldOfferAiReview: boolean;
};

export type ScoreInputValues = {
  throatEase: number;
  voiceStability: number;
  resonanceForward: number;
  sentenceEnding: number;
  naturalness: number;
  difficulty: number;
};

export type SessionDraft = {
  id: string;
  startedAt: string;
  recommendation: RecommendationResult;
  availableMinutes: 3 | 5 | 10 | 20;
  currentStatus: CurrentStatus;
  focusPreference: FocusPreference;
  actualDurationSec?: number;
};
