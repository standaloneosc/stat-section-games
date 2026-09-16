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
    { id: "randomLocal", label: "Wander", probability: 0.2 },
  ],
  spider: [
    { id: "stay", label: "Stay", probability: 0.2 },
    { id: "cardinal", label: "Cardinal", probability: 0.3 },
    { id: "diagonal", label: "Diagonal", probability: 0.5 },
  ],
  hunter: [
    { id: "stay", label: "Stay", probability: 0.2 },
    { id: "randomLocal", label: "Wander", probability: 0.3 },
    { id: "targetSeeking", label: "Hunt the center", probability: 0.5 },
  ],
};

export const TRAIT_DESCRIPTIONS: Record<MonsterTrait, string> = {
  walker:
    "The Walker stays put, steps left or right, steps up or down, or wanders among the current square and its orthogonal neighbors.",
  spider:
    "The Spider stays, steps in a cardinal direction, or takes a diagonal. Those modes are not equally likely.",
  hunter:
    "The Hunter stays, wanders locally, or hunts the center. Hunting puts extra weight on the middle when that square is reachable.",
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

function localTrait(trait: MonsterTrait): MonsterTrait {
  return trait === "walker" ? "walker" : "spider";
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
    case "targetSeeking":
      return huntCenterWeights(position, trait, gridSize);
    default:
      throw new Error(`Unknown movement mode: ${modeId}`);
  }
}

export function huntCenterWeights(
  position: Position,
  trait: MonsterTrait,
  gridSize: number
): Record<string, number> {
  const destinations = getLocalDestinations(position, localTrait(trait), gridSize);
  const centerKey = posKey(CENTER);
  const keys = destinations.map(posKey);
  if (!keys.includes(centerKey) || keys.length <= 1) {
    return uniformWeights(destinations);
  }
  const otherCount = keys.length - 1;
  const weights: Record<string, number> = {};
  for (const key of keys) {
    weights[key] = key === centerKey ? 1.5 * otherCount : 1;
  }
  return normalizeDistribution(weights);
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
    randomLocal: "Wander",
    targetSeeking: "Hunt the center",
    noticed: "Noticed players",
    "not-noticed": "Did not notice",
  };
  return named[id] ?? id;
}

export function describeModeMotion(modeId: string, trait: MonsterTrait): string {
  switch (modeId) {
    case "stay":
      return "Stays on the current square";
    case "horizontal":
      return "Steps left or right (equal among open sides)";
    case "vertical":
      return "Steps up or down (equal among open sides)";
    case "cardinal":
      return "Steps up, down, left, or right";
    case "diagonal":
      return "Steps diagonally";
    case "randomLocal":
      return trait === "walker"
        ? "Stays or steps to any orthogonal neighbor, equally"
        : "Stays or steps to any adjacent square, equally";
    case "targetSeeking":
      return "Puts extra weight on the center when that square is in range";
    default:
      return "Moves locally";
  }
}

export function noticedMotionBlurb(trait: MonsterTrait): string {
  if (trait === "walker") {
    return "If it noticed the class, it still only stays or steps orthogonally — corners stay out of range. Hunt the center with 6 shares on the middle and 1 share on each open side, then mix that hunt with the table below using P(noticed | hint).";
  }
  if (trait === "spider") {
    return "If it noticed the class, it may step diagonally and hunts the center. When the center is in range it gets 6 parts out of 10; the other legal squares share the rest equally. Mix that hunt with the table using P(noticed | hint).";
  }
  return "If it noticed the class, it hunts the center. When the center is in range it gets 6 parts out of 10; the other legal squares share the rest equally. Mix that hunt with the table using P(noticed | hint).";
}

export function resolveModeCatalog(roundConfig: RoundConfig) {
  if (roundConfig.monster.movementModes && roundConfig.monster.movementModes.length > 0) {
    const catalog = roundConfig.monster.movementModes.filter(
      (mode) => mode.id !== "noticed" && mode.id !== "not-noticed"
    );
    if (catalog.length > 0) {
      return catalog.map((mode) => ({
        id: mode.id,
        label: modeLabel(mode.id, mode.label),
        probability: mode.probability,
      }));
    }
  }
  return TRAIT_MODE_CATALOG[roundConfig.monster.trait];
}

export function buildTraitMovementModes(roundConfig: RoundConfig): MovementMode[] {
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

export function buildMovementModes(roundConfig: RoundConfig): MovementMode[] {
  const traitModes = buildTraitMovementModes(roundConfig);
  if (roundConfig.bayes.enabled) {
    const notNoticed = mixDistributions(
      traitModes.map((mode) => ({
        probability: mode.probability,
        distribution: mode.destinationWeights,
      }))
    );
    const noticed = huntCenterWeights(
      roundConfig.monster.currentPosition,
      roundConfig.monster.trait,
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
  return traitModes;
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
