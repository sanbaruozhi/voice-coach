import { CurrentStatus, TrainingModule } from '../types';

export function isModuleAllowedBySafety(module: TrainingModule, status: CurrentStatus) {
  if (status === 'tired') {
    return module.suitableWhenTired && module.intensity !== 'high' && module.durationSec <= 90;
  }
  if (status === 'silent') {
    return !module.requiresVoice && !module.requiresRecording;
  }
  return true;
}

export function safetyNoticeForStatus(status: CurrentStatus) {
  if (status === 'tired') {
    return '今天不建议做强发声训练。不追求音色，只追求喉咙轻松。';
  }
  if (status === 'silent') {
    return '当前不方便出声，本次只安排身体、放松和无声气息训练。';
  }
  return undefined;
}
