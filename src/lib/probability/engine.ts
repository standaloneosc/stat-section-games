import {
  calculateBayesPosterior,
  clueIsWarning,
  evidenceProbability,
} from "./bayes";
import { buildMovementModes, getMovementDistribution } from "./movement";
import { sampleCategoricalDistribution } from "./sample";
import type { Position, RoundConfig } from "./types";
import { RoundConfigError, validateMovementModes } from "./validate";

export function getLegalSquares(roundConfig: RoundConfig): string[] {
  const distribution = getMovementDistribution(roundConfig);
  return Object.entries(distribution)
    .filter(([, probability]) => probability > PROB_ZERO)
    .map(([key]) => key)
    .sort();
}

const PROB_ZERO = 1e-12;

export function calculateHitProbabilityForSquare(
  square: string,
  roundConfig: RoundConfig
): number {
  if (roundConfig.bayes.enabled && roundConfig.bayes.clueId) {
    const posteriorPredictive = getPosteriorPredictiveDistribution(roundConfig);
    return posteriorPredictive[square] ?? 0;
  }
  const distribution = getMovementDistribution(roundConfig);
  return distribution[square] ?? 0;
}

export function getCorrectHitProbabilities(
  roundConfig: RoundConfig
): Record<string, number> {
  if (roundConfig.bayes.enabled && roundConfig.bayes.clueId) {
    return getPosteriorPredictiveDistribution(roundConfig);
  }
  return getMovementDistribution(roundConfig);
}

export function getPosteriorPredictiveDistribution(
  roundConfig: RoundConfig
): Record<string, number> {
  const modes = buildMovementModes(roundConfig);
  const noticed = modes.find((mode) => mode.id === "noticed");
  const notNoticed = modes.find((mode) => mode.id === "not-noticed");
  if (!noticed || !notNoticed) {
    return getMovementDistribution(roundConfig);
  }
  const posterior = calculateBayesPosterior(
    roundConfig.bayes.priorNoticed,
    roundConfig.bayes.clueLikelihoodIfNoticed,
    roundConfig.bayes.clueLikelihoodIfNotNoticed,
    clueIsWarning(roundConfig.bayes.clueId)
  );
  return {
    ...mixKeys(noticed.destinationWeights, notNoticed.destinationWeights, posterior),
  };
}

function mixKeys(
  ifTrue: Record<string, number>,
  ifFalse: Record<string, number>,
  posteriorTrue: number
): Record<string, number> {
  const keys = new Set([...Object.keys(ifTrue), ...Object.keys(ifFalse)]);
  const mixed: Record<string, number> = {};
  for (const key of keys) {
    mixed[key] =
      (ifTrue[key] ?? 0) * posteriorTrue +
      (ifFalse[key] ?? 0) * (1 - posteriorTrue);
  }
  return mixed;
}

export function validateRoundConfig(roundConfig: RoundConfig): void {
  const modes = buildMovementModes(roundConfig);
  const distribution = validateMovementModes(modes);
  const legal = getLegalSquares(roundConfig);
  for (const square of legal) {
    if ((distribution[square] ?? 0) <= 0) {
      throw new RoundConfigError(`Legal square ${square} has zero probability`);
    }
  }
}

export { getNeighborPositions } from "./neighbors";
export { getMovementDistribution } from "./movement";
export { calculateBayesPosterior } from "./bayes";
export { calculateProbabilityBonus, calculateSurvivalReward } from "./scoring";
export { sampleCategoricalDistribution } from "./sample";
export { posKey, parsePosKey } from "./positions";

export function sampleMonsterDestination(
  roundConfig: RoundConfig,
  randomValues: { modeOrState: number; destination: number }
): { modeId: string; destination: Position } {
  if (roundConfig.bayes.enabled) {
    const hiddenState =
      roundConfig.bayes.hiddenState ??
      (randomValues.modeOrState < roundConfig.bayes.priorNoticed
        ? "noticed"
        : "not-noticed");
    const modes = buildMovementModes(roundConfig);
    const mode = modes.find((item) => item.id === hiddenState);
    if (!mode) {
      throw new Error("Bayes round is missing a hidden-state movement mode");
    }
    const key = sampleCategoricalDistribution(
      mode.destinationWeights,
      randomValues.destination
    );
    return { modeId: hiddenState, destination: parseKey(key) };
  }

  const modes = buildMovementModes(roundConfig);
  const modeId = sampleCategoricalDistribution(
    Object.fromEntries(modes.map((mode) => [mode.id, mode.probability])),
    randomValues.modeOrState
  );
  const mode = modes.find((item) => item.id === modeId);
  if (!mode) {
    throw new Error(`Unknown sampled mode ${modeId}`);
  }
  const key = sampleCategoricalDistribution(
    mode.destinationWeights,
    randomValues.destination
  );
  return { modeId, destination: parseKey(key) };
}

function parseKey(key: string): Position {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

export function squareHasPositiveProbability(
  square: string,
  roundConfig: RoundConfig
): boolean {
  return calculateHitProbabilityForSquare(square, roundConfig) > PROB_ZERO;
}

export function evidenceProbabilityForRound(roundConfig: RoundConfig): number {
  if (!roundConfig.bayes.enabled) {
    return 0;
  }
  return evidenceProbability(
    roundConfig.bayes.priorNoticed,
    roundConfig.bayes.clueLikelihoodIfNoticed,
    roundConfig.bayes.clueLikelihoodIfNotNoticed,
    clueIsWarning(roundConfig.bayes.clueId)
  );
}

export function posteriorForRound(roundConfig: RoundConfig): number | null {
  if (!roundConfig.bayes.enabled || !roundConfig.bayes.clueId) {
    return null;
  }
  return calculateBayesPosterior(
    roundConfig.bayes.priorNoticed,
    roundConfig.bayes.clueLikelihoodIfNoticed,
    roundConfig.bayes.clueLikelihoodIfNotNoticed,
    clueIsWarning(roundConfig.bayes.clueId)
  );
}
