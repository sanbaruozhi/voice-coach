import { SessionTemplate } from '../types';

export const sessionTemplates: SessionTemplate[] = [
  {
    id: 'pre-meeting-3',
    name: '会议前 3 分钟包',
    durationMin: 3,
    goal: '开口更稳，句尾更落。',
    moduleIds: ['breath-pre-meeting', 'sovt-closed-hum', 'resonance-official-short', 'tone-before-pause'],
    reasonHint: '现在适合做会议前热身，目标不是练新东西，而是让开口更稳。',
    statusFit: ['preMeeting'],
  },
  {
    id: 'tired-recovery-3',
    name: '嗓子累 3 分钟恢复包',
    durationMin: 3,
    goal: '不追求音色，只让喉咙轻松。',
    moduleIds: ['relax-shoulder-neck', 'relax-yawn-sigh', 'sovt-closed-hum'],
    reasonHint: '今天不建议做强发声训练，先让喉咙轻松下来。',
    statusFit: ['tired'],
  },
  {
    id: 'silent-3',
    name: '不方便出声 3 分钟包',
    durationMin: 3,
    goal: '不出声也能维护气息和身体状态。',
    moduleIds: ['relax-posture-reset', 'relax-shoulder-neck', 'breath-low-inhale', 'breath-f-flow'],
    reasonHint: '当前不方便出声，先做身体和气息维护。',
    statusFit: ['silent'],
  },
  {
    id: 'breath-5',
    name: '5 分钟气息稳定包',
    durationMin: 5,
    goal: '声音不断、不虚、不前冲后塌。',
    moduleIds: ['relax-shoulder-neck', 'breath-low-inhale', 'breath-s-flow', 'breath-one-sentence'],
    reasonHint: '今天先抓气息稳定，让一句话有余量。',
  },
  {
    id: 'resonance-5',
    name: '5 分钟共鸣靠前包',
    durationMin: 5,
    goal: '声音往前送，不压喉咙。',
    moduleIds: ['relax-yawn-sigh', 'resonance-closed-ng', 'resonance-ng-ma', 'resonance-official-short'],
    reasonHint: '最近共鸣练得少，适合用轻哼和短句把声音放靠前。',
  },
  {
    id: 'tone-5',
    name: '5 分钟稳重语气包',
    durationMin: 5,
    goal: '句尾落住，语气稳而不硬。',
    moduleIds: ['tone-before-pause', 'tone-conclusion-slow', 'tone-keyword-weight', 'tone-official-report'],
    reasonHint: '今天只抓稳重语气：慢一点、落一点、不要硬。',
  },
  {
    id: 'standard-10',
    name: '10 分钟标准稳声包',
    durationMin: 10,
    goal: '放松、气息、共鸣、短句迁移和自评完整跑一遍。',
    moduleIds: [
      'relax-shoulder-neck',
      'breath-low-inhale',
      'sovt-closed-hum',
      'resonance-official-short',
      'tone-official-report',
      'articulation-ending',
    ],
    reasonHint: '时间足够，适合做一次标准训练闭环。',
  },
  {
    id: 'complete-20',
    name: '20 分钟完整训练包',
    durationMin: 20,
    goal: '从身体、气息、轻发声到公务场景完整迁移。',
    moduleIds: [
      'relax-shoulder-neck',
      'relax-tongue-root',
      'breath-low-inhale',
      'breath-s-flow',
      'sovt-closed-hum',
      'resonance-closed-ng',
      'resonance-ng-ma',
      'articulation-keyword',
      'tone-ending-land',
      'tone-official-report',
    ],
    reasonHint: '今天可以完整训练，但仍以省力和稳定为边界。',
  },
];

export const templateById = Object.fromEntries(sessionTemplates.map((item) => [item.id, item])) as Record<
  string,
  SessionTemplate
>;
