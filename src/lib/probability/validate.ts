import { mixDistributions } from "./movement";
import { PROBABILITY_TOLERANCE, type MovementMode } from "./types";

export class RoundConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoundConfigError";
  }
}

export function assertProbabilities(
  values: number[],
  label: string,
  tolerance = PROBABILITY_TOLERANCE
): void {
  for (const value of values) {
    if (value < -tolerance) {
      throw new RoundConfigError(`${label} contains a negative probability`);
    }
  }
  const sum = values.reduce((total, value) => total + value, 0);
  if (Math.abs(sum - 1) > tolerance) {
    throw new RoundConfigError(
      `${label} probabilities sum to ${sum}, expected 1`
    );
  }
}

export function validateMovementModes(modes: MovementMode[]): Record<string, number> {
  if (modes.length === 0) {
    throw new RoundConfigError("A round needs at least one movement mode");
  }
  assertProbabilities(
    modes.map((mode) => mode.probability),
    "Movement modes"
  );
  for (const mode of modes) {
    const destinations = Object.entries(mode.destinationWeights);
    if (destinations.length === 0) {
      throw new RoundConfigError(
        `Movement mode ${mode.id} has no valid destination after edge handling`
      );
    }
    assertProbabilities(
      destinations.map(([, probability]) => probability),
      `Mode ${mode.id}`
    );
  }
  const distribution = mixDistributions(
    modes.map((mode) => ({
      probability: mode.probability,
      distribution: mode.destinationWeights,
    }))
  );
  const legal = Object.entries(distribution).filter(([, probability]) => probability > 0);
  if (legal.length < 2) {
    throw new RoundConfigError("Round configuration has fewer than two legal squares");
  }
  for (const [key, probability] of legal) {
    if (probability <= 0) {
      throw new RoundConfigError(`Legal square ${key} has zero probability`);
    }
  }
  return distribution;
}
