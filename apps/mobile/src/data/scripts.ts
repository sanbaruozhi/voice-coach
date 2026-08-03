export type BuiltInScript = {
  id: string;
  title: string;
  scenario: string;
  text: string;
};

export const builtInScripts: BuiltInScript[] = [
  {
    id: 'report',
    title: '汇报稿',
    scenario: '向领导汇报',
    text: '领导，我简要汇报三点。\n第一，目前这项工作总体可控。\n第二，主要风险不在方向，而在口径是否统一、责任是否明确。\n第三，我的建议是，今天先把基础材料补齐，明天再形成正式意见。',
  },
  {
    id: 'coordination',
    title: '协调稿',
    scenario: '协调同事',
    text: '这个问题，我们可以分两步处理。\n能马上推进的，今天先落实。\n需要进一步核实的，明天上午再统一口径。',
  },
  {
    id: 'risk-reminder',
    title: '提醒风险稿',
    scenario: '提不同意见',
    text: '这个思路有价值。\n不过从稳妥性看，我有一点顾虑。\n建议先小范围验证，再决定是否全面推开。',
  },
  {
    id: 'public-explain',
    title: '群众解释稿',
    scenario: '向群众解释',
    text: '您的意思我听明白了。\n核心是担心后续办理时间和反馈渠道。\n这个问题我们分两步处理。\n能马上办的，我先帮您落实。\n需要核实的，我再给您明确答复。',
  },
];
