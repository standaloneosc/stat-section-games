import type {
  CorrectChoice,
  PatternChoice,
  RoundScore,
  ScoringConfig,
} from "./types";
import { DEFAULT_SCORING_CONFIG } from "./types";

export function calculateCorrectChoice(
  patternAProbability: number,
  patternBProbability: number,
  tolerance: number = DEFAULT_SCORING_CONFIG.choiceTieTolerance
): CorrectChoice {
  if (Math.abs(patternAProbability - patternBProbability) < tolerance) {
    return "tie";
  }
  return patternAProbability > patternBProbability ? "A" : "B";
}

export function calculateCorrectChoicePoints(
  patternAProbability: number,
  patternBProbability: number,
  chosenPattern: PatternChoice | null,
  config: Pick<ScoringConfig, "choiceTieTolerance" | "correctChoicePoints"> = DEFAULT_SCORING_CONFIG
): number {
  if (!chosenPattern) {
    return 0;
  }
  const correct = calculateCorrectChoice(
    patternAProbability,
    patternBProbability,
    config.choiceTieTolerance
  );
  if (correct === "tie" || correct === chosenPattern) {
    return config.correctChoicePoints;
  }
  return 0;
}

export function calculateProbabilityPoints(
  estimate: number | null,
  correctProbability: number,
  maxPoints: number = DEFAULT_SCORING_CONFIG.probabilityPoints
): number {
  if (estimate === null || !Number.isFinite(estimate)) {
    return 0;
  }
  const probabilityError = Math.abs(estimate - correctProbability);
  return Math.round(maxPoints * Math.max(0, 1 - probabilityError / 0.25));
}

export function calculateSpeedPoints(
  submittedAt: Date | string | number,
  roundStartedAt: Date | string | number,
  decisionTimeSeconds: number,
  maxPoints: number = DEFAULT_SCORING_CONFIG.speedPoints
): number {
  const submitted = new Date(submittedAt).getTime();
  const started = new Date(roundStartedAt).getTime();
  const elapsedSeconds = Math.max(0, (submitted - started) / 1000);
  const timeFraction = Math.max(0, 1 - elapsedSeconds / decisionTimeSeconds);
  return Math.round(maxPoints * timeFraction);
}

export function calculateBayesBonus(
  studentPosterior: number | null,
  correctPosterior: number | null,
  maxPoints: number = DEFAULT_SCORING_CONFIG.bayesBonusPoints
): number {
  if (correctPosterior === null || studentPosterior === null || !Number.isFinite(studentPosterior)) {
    return 0;
  }
  const bayesError = Math.abs(studentPosterior - correctPosterior);
  return Math.round(maxPoints * Math.max(0, 1 - bayesError / 0.25));
}

export function calculateRoundScore(scoreParts: {
  correctChoicePoints: number;
  probabilityPoints: number;
  speedPoints: number;
  bayesBonus: number;
}): RoundScore {
  return {
    correctChoicePoints: scoreParts.correctChoicePoints,
    probabilityPoints: scoreParts.probabilityPoints,
    speedPoints: scoreParts.speedPoints,
    bayesBonus: scoreParts.bayesBonus,
    total:
      scoreParts.correctChoicePoints +
      scoreParts.probabilityPoints +
      scoreParts.speedPoints +
      scoreParts.bayesBonus,
  };
}
