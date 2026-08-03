export const stages = {
  1: {
    name: '省力发声',
    goals: ['喉咙不紧', '气息不断', '声音不虚', '说完不累'],
  },
  2: {
    name: '共鸣靠前',
    goals: ['声音不闷', '不靠喊也能听清', '口腔前部有轻微振动感'],
  },
  3: {
    name: '稳重语气',
    goals: ['第一字不冲', '关键句降速', '句尾落住', '听起来稳而不硬'],
  },
  4: {
    name: '公务场景迁移',
    goals: ['把好声音用到汇报、协调、提醒、解释里'],
  },
} as const;

export function stageForDaysSinceLastSession(currentStage: 1 | 2 | 3 | 4, days: number | null) {
  if (days !== null && days >= 8) {
    return Math.max(1, currentStage - 1) as 1 | 2 | 3 | 4;
  }
  return currentStage;
}
