function json(value) {
  return JSON.stringify(value, (_, item) => typeof item === 'bigint' ? `${item}n` : item, 2);
}

export function formatRawData(observations) {
  return `## Raw data\n\n\`\`\`json\n${json(observations)}\n\`\`\``;
}

export function formatInference(inferences) {
  if (!Array.isArray(inferences)) throw new TypeError('inferences must be an array');
  return `## What can be inferred\n\n${inferences.map((item) => `- ${item}`).join('\n')}`;
}
