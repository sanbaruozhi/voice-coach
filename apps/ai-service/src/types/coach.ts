export type WeeklySummaryResponse = {
  summary: string;
  progress: string[];
  weaknesses: string[];
  likelyReasons: string[];
  nextWeekFocus: string;
  actionItems: string[];
  reminder: string;
};

export type GeneratedScript = {
  title: string;
  text: string;
  practiceTips: string[];
};

export type GenerateScriptResponse = {
  scripts: GeneratedScript[];
};

export type RecordingAnalysisResponse = {
  summary: string;
  strengths: string[];
  issues: string[];
  specificAdvice: string[];
  nextPractice: {
    focus: string;
    recommendedSession: string;
    reason: string;
  };
  caution: string;
};

export type CoachCommentaryResponse = {
  coachMessage: string;
  oneThingToWatch: string;
  afterPracticeQuestion: string;
};

export type NextPracticeStep = {
  id: string;
  title: string;
  seconds: number;
  cue: string;
  instruction: string;
};

export type NextPracticeResponse = {
  id: string;
  title: string;
  minutes: number;
  goal: string;
  reason: string;
  source: 'ai' | 'local';
  steps: NextPracticeStep[];
};
