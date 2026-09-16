export function calculateProbabilityBonus(
  estimate: number,
  correctProbability: number
): number {
  const error = Math.abs(estimate - correctProbability);
  return Math.round(20 * Math.max(0, 1 - error / 0.25));
}

export function calculateSurvivalReward(
  baseReward: number,
  otherPlayersOnSquare: number,
  survived: boolean
): number {
  if (!survived) {
    return 0;
  }
  if (otherPlayersOnSquare < 0) {
    throw new Error("otherPlayersOnSquare cannot be negative");
  }
  return Math.round((baseReward / (1 + otherPlayersOnSquare)) * 100) / 100;
}

export function calculationError(
  estimate: number,
  correctProbability: number
): number {
  return Math.abs(estimate - correctProbability);
}

export function brierScore(estimate: number, outcome: 0 | 1): number {
  const delta = estimate - outcome;
  return delta * delta;
}
