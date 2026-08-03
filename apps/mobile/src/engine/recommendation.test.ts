import { recommendSession } from './recommendation';
import { RecommendationInput } from '../types';

const base: RecommendationInput = {
  availableMinutes: 5,
  currentStatus: 'normal',
  focusPreference: 'appDecides',
  daysSinceLastSession: null,
  recentSessions: [],
  recentModules: [],
  averageScores: {},
  weakCategories: [],
  currentStage: 1,
};

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(recommendSession({ ...base, currentStatus: 'tired' }).sessionTemplateId === 'tired-recovery-3', 'tired');
assert(recommendSession({ ...base, currentStatus: 'silent' }).sessionTemplateId === 'silent-3', 'silent');
assert(recommendSession({ ...base, currentStatus: 'preMeeting' }).sessionTemplateId === 'pre-meeting-3', 'preMeeting');
assert(recommendSession({ ...base, daysSinceLastSession: 5 }).recommendationReason.includes('恢复'), '4-7 days');
assert(recommendSession({ ...base, daysSinceLastSession: 9 }).recommendationReason.includes('恢复手感'), '8+ days');
assert(recommendSession({ ...base, availableMinutes: 20 }).sessionTemplateId === 'complete-20', '20 min');
assert(recommendSession({ ...base, focusPreference: 'resonance' }).sessionTemplateId === 'resonance-5', 'focus');

console.log('recommendation rules ok');
