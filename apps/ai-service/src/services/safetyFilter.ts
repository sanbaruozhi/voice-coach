const unsafeThroatWords = ['嗓子疼', '喉咙疼', '明显嘶哑', '说话费力', '疼痛', '失声'];

export function hasThroatRiskText(input: unknown) {
  const text = JSON.stringify(input ?? '');
  return unsafeThroatWords.some((word) => text.includes(word));
}

export function enforceSafetyCaution<T extends { caution?: string }>(payload: T, source: unknown): T {
  if (!hasThroatRiskText(source)) {
    return payload;
  }
  return {
    ...payload,
    caution:
      '如果今天嗓子疼、明显嘶哑或说话费力，请停止发声训练，只做放松和低位呼吸；必要时咨询专业医生。',
  };
}
