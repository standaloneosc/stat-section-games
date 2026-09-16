export type Position = {
  x: number;
  y: number;
};

export type MonsterTrait = "walker" | "spider" | "hunter";

export type MovementMode = {
  id: string;
  label: string;
  probability: number;
  destinationWeights: Record<string, number>;
};

export type BayesState = {
  enabled: boolean;
  hiddenState: "noticed" | "not-noticed" | null;
  priorNoticed: number | null;
  clueId: string | null;
  clueLikelihoodIfNoticed: number | null;
  clueLikelihoodIfNotNoticed: number | null;
};

export type RoundConfig = {
  gridSize: number;
  monster: {
    trait: MonsterTrait;
    currentPosition: Position;
    movementModes?: Array<{ id: string; label?: string; probability: number }>;
  };
  bayes: {
    enabled: boolean;
    hiddenState?: "noticed" | "not-noticed" | null;
    priorNoticed: number;
    clueId?: string | null;
    clueLikelihoodIfNoticed: number;
    clueLikelihoodIfNotNoticed: number;
  };
};

export const PROBABILITY_TOLERANCE = 1e-9;
export const CENTER: Position = { x: 1, y: 1 };
export const DEFAULT_GRID_SIZE = 3;
