import { getLocalDestinations, getNeighborPositions } from "./neighbors";
import { posKey } from "./positions";
import type { MonsterTrait, MovementMode, Position, RoundConfig } from "./types";
import { CENTER, PROBABILITY_TOLERANCE } from "./types";

export const TRAIT_MODE_CATALOG: Record<
  MonsterTrait,
  Array<{ id: string; label: string; probability: number }>
> = {
  walker: [
    { id: "stay", label: "Stay", probability: 0.2 },
    { id: "horizontal", label: "Horizontal", probability: 0.3 },
    { id: "vertical", label: "Vertical", probability: 0.3 },
    { id: "randomLocal", label: "Random local", probability: 0.2 },
  ],
  spider: [
    { id: "stay", label: "Stay", probability: 0.15 },
    { id: "cardinal", label: "Cardinal", probability: 0.35 },
    { id: "diagonal", label: "Diagonal", probability: 0.3 },
    { id: "randomLocal", label: "Random local", probability: 0.2 },
  ],
  hunter: [
    { id: "stay", label: "Stay", probability: 0.15 },
    { id: "randomLocal", label: "Random local", probability: 0.45 },
    { id: "targetSeeking", label: "Target-seeking", probability: 0.4 },
  ],
};

export const TRAIT_DESCRIPTIONS: Record<MonsterTrait, string> = {
  walker:
    "The Walker stays put or steps one square north, south, east, or west. It cannot move diagonally.",
  spider:
    "The Spider stays put or skitters one square in any of the eight directions, including diagonally.",
  hunter:
    "The Hunter stays put or moves one square in any direction, and it puts extra weight on the center square when that square is in range.",
};

function uniformWeights(positions: Position[]): Record<string, number> {
  if (positions.length === 0) {
    return {};
  }
  const weight = 1 / positions.length;
  const weights: Record<string, number> = {};
  for (const position of positions) {
    const key = posKey(position);
    weights[key] = (weights[key] ?? 0) + weight;
  }
  return weights;
}

export function normalizeDistribution(
  weights: Record<string, number>
): Record<string, number> {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return {};
  }
  const normalized: Record<string, number> = {};
  for (const [key, value] of Object.entries(weights)) {
    if (value < 0) {
      throw new Error(`Negative weight for ${key}`);
    }
    if (value > 0) {
      normalized[key] = value / total;
    }
  }
  return normalized;
}

export function destinationWeightsForMode(
  position: Position,
  trait: MonsterTrait,
  modeId: string,
  gridSize: number
): Record<string, number> {
  const orthogonal = getNeighborPositions(position, "walker", gridSize);
  const allLocal = getNeighborPositions(position, "spider", gridSize);
  const stay = [position];

  switch (modeId) {
    case "stay":
      return uniformWeights(stay);
    case "horizontal":
      return uniformWeights(orthogonal.filter((cell) => cell.y === position.y));
    case "vertical":
      return uniformWeights(orthogonal.filter((cell) => cell.x === position.x));
    case "cardinal":
      return uniformWeights(orthogonal);
    case "diagonal":
      return uniformWeights(
        allLocal.filter((cell) => cell.x !== position.x && cell.y !== position.y)
      );
    case "randomLocal":
      if (trait === "walker") {
        return uniformWeights([...stay, ...orthogonal]);
      }
      return uniformWeights(getLocalDestinations(position, "spider", gridSize));
    case "targetSeeking": {
      const destinations = getLocalDestinations(position, "spider", gridSize);
      const centerKey = posKey(CENTER);
      const keys = destinations.map(posKey);
      const hasCenter = keys.includes(centerKey);
      if (!hasCenter || keys.length <= 1) {
        return uniformWeights(destinations);
      }
      const otherCount = keys.length - 1;
      const weights: Record<string, number> = {};
      for (const key of keys) {
        weights[key] = key === centerKey ? 1.5 * otherCount : 1;
      }
      return normalizeDistribution(weights);
    }
    default:
      throw new Error(`Unknown movement mode: ${modeId}`);
  }
}

function modeLabel(id: string, fallback?: string): string {
  if (fallback) {
    return fallback;
  }
  const named: Record<string, string> = {
    stay: "Stay",
    horizontal: "Horizontal",
    vertical: "Vertical",
    cardinal: "Cardinal",
    diagonal: "Diagonal",
    randomLocal: "Random local",
    targetSeeking: "Target-seeking",
    noticed: "Noticed players",
    "not-noticed": "Did not notice",
  };
  return named[id] ?? id;
}

export function resolveModeCatalog(roundConfig: RoundConfig) {
  if (roundConfig.monster.movementModes && roundConfig.monster.movementModes.length > 0) {
    return roundConfig.monster.movementModes.map((mode) => ({
      id: mode.id,
      label: modeLabel(mode.id, mode.label),
      probability: mode.probability,
    }));
  }
  return TRAIT_MODE_CATALOG[roundConfig.monster.trait];
}

export function buildMovementModes(roundConfig: RoundConfig): MovementMode[] {
  if (roundConfig.bayes.enabled) {
    const noticed = destinationWeightsForMode(
      roundConfig.monster.currentPosition,
      "hunter",
      "targetSeeking",
      roundConfig.gridSize
    );
    const notNoticed = destinationWeightsForMode(
      roundConfig.monster.currentPosition,
      "hunter",
      "randomLocal",
      roundConfig.gridSize
    );
    return [
      {
        id: "noticed",
        label: "Noticed players",
        probability: roundConfig.bayes.priorNoticed,
        destinationWeights: noticed,
      },
      {
        id: "not-noticed",
        label: "Did not notice",
        probability: 1 - roundConfig.bayes.priorNoticed,
        destinationWeights: notNoticed,
      },
    ];
  }

  return resolveModeCatalog(roundConfig).map((mode) => ({
    id: mode.id,
    label: modeLabel(mode.id, mode.label),
    probability: mode.probability,
    destinationWeights: destinationWeightsForMode(
      roundConfig.monster.currentPosition,
      roundConfig.monster.trait,
      mode.id,
      roundConfig.gridSize
    ),
  }));
}

export function mixDistributions(
  parts: Array<{ probability: number; distribution: Record<string, number> }>
): Record<string, number> {
  const mixed: Record<string, number> = {};
  for (const part of parts) {
    for (const [key, value] of Object.entries(part.distribution)) {
      mixed[key] = (mixed[key] ?? 0) + part.probability * value;
    }
  }
  return mixed;
}

export function getMovementDistribution(
  roundConfig: RoundConfig
): Record<string, number> {
  const modes = buildMovementModes(roundConfig);
  return mixDistributions(
    modes.map((mode) => ({
      probability: mode.probability,
      distribution: mode.destinationWeights,
    }))
  );
}

export function distributionsClose(
  actual: Record<string, number>,
  expected: Record<string, number>,
  tolerance = PROBABILITY_TOLERANCE
): boolean {
  const keys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
  for (const key of keys) {
    if (Math.abs((actual[key] ?? 0) - (expected[key] ?? 0)) > tolerance) {
      return false;
    }
  }
  return true;
}
