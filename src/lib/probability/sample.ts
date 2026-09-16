export function sampleCategoricalDistribution(
  distribution: Record<string, number>,
  randomValue: number
): string {
  const entries = Object.entries(distribution).filter(([, probability]) => probability > 0);
  if (entries.length === 0) {
    throw new Error("Cannot sample from an empty distribution");
  }
  if (!Number.isFinite(randomValue)) {
    throw new Error("randomValue must be a finite number");
  }
  const clamped = Math.min(Math.max(randomValue, 0), 0.999999999999);
  const total = entries.reduce((sum, [, probability]) => sum + probability, 0);
  let cumulative = 0;
  for (const [key, probability] of entries) {
    cumulative += probability / total;
    if (clamped < cumulative) {
      return key;
    }
  }
  return entries[entries.length - 1][0];
}

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
