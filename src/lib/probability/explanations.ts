import { clueText } from "./bayes";
import { buildMovementModes } from "./movement";
import { formatPosition, parsePosKey, posKey } from "./positions";
import type { MovementMode, Position, RoundConfig } from "./types";
import { calculateHitProbabilityForSquare, posteriorForRound } from "./engine";

export function formatProbability(value: number, digits = 4): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  const rounded = Number(value.toFixed(digits));
  if (Object.is(rounded, -0)) {
    return (0).toFixed(digits);
  }
  return rounded.toFixed(digits);
}

export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function buildLotpExplanation(options: {
  square: string;
  modes: MovementMode[];
  correctProbability: number;
}): string {
  const position = formatPosition(parsePosKey(options.square));
  const terms = options.modes.map((mode) => {
    const conditional = mode.destinationWeights[options.square] ?? 0;
    return `(${formatProbability(conditional, 2)})(${formatProbability(mode.probability, 2)})`;
  });
  return `The correct probability for square ${position} was ${formatProbability(options.correctProbability, 2)}. We found this by weighting the conditional probability of moving there under each movement mode by that mode's probability. This is the law of total probability.\n\nP${position} = ${terms.join(" + ")} = ${formatProbability(options.correctProbability, 2)}`;
}

export function buildBayesExplanation(options: {
  roundConfig: RoundConfig;
  square: string;
  correctHitProbability: number;
}): string {
  const { roundConfig, square, correctHitProbability } = options;
  const posterior = posteriorForRound(roundConfig);
  if (posterior === null) {
    return buildLotpExplanation({
      square,
      modes: [],
      correctProbability: correctHitProbability,
    });
  }
  const prior = roundConfig.bayes.priorNoticed;
  const likeTrue = roundConfig.bayes.clueLikelihoodIfNoticed;
  const likeFalse = roundConfig.bayes.clueLikelihoodIfNotNoticed;
  const warning = roundConfig.bayes.clueId === "warning";
  const pEvidence = warning
    ? likeTrue * prior + likeFalse * (1 - prior)
    : (1 - likeTrue) * prior + (1 - likeFalse) * (1 - prior);
  const noticedHit = calculateConditional(roundConfig, square, true);
  const notHit = calculateConditional(roundConfig, square, false);
  const clue = clueText(roundConfig.bayes.clueId);
  const position = formatPosition(parsePosKey(square));
  return `${clue} Using Bayes' rule, P(noticed | clue) = P(clue | noticed)P(noticed) / P(clue) = (${formatProbability(warning ? likeTrue : 1 - likeTrue, 2)})(${formatProbability(prior, 2)}) / ${formatProbability(pEvidence, 2)} = ${formatProbability(posterior, 4)}.\n\nThe hit probability for ${position} then mixes the noticed and not-noticed movement distributions with this posterior:\nP(hit ${position} | clue) = (${formatProbability(noticedHit, 2)})(${formatProbability(posterior, 4)}) + (${formatProbability(notHit, 2)})(${formatProbability(1 - posterior, 4)}) ≈ ${formatProbability(correctHitProbability, 4)}.`;
}

function calculateConditional(
  roundConfig: RoundConfig,
  square: string,
  noticed: boolean
): number {
  const modes = buildMovementModes({
    ...roundConfig,
    bayes: { ...roundConfig.bayes, enabled: true },
  });
  const mode = modes.find((item) => item.id === (noticed ? "noticed" : "not-noticed"));
  return mode?.destinationWeights[square] ?? 0;
}

export function explanationForRound(options: {
  roundConfig: RoundConfig;
  modes: MovementMode[];
  square: string;
  monsterStart: Position;
}): string {
  const correct = calculateHitProbabilityForSquare(options.square, options.roundConfig);
  if (options.roundConfig.bayes.enabled) {
    return buildBayesExplanation({
      roundConfig: options.roundConfig,
      square: options.square,
      correctHitProbability: correct,
    });
  }
  return buildLotpExplanation({
    square: options.square,
    modes: options.modes,
    correctProbability: correct,
  });
}

export function defaultExplanationSquare(
  legalSquares: string[],
  start: Position
): string {
  const left = posKey({ x: start.x - 1, y: start.y });
  if (legalSquares.includes(left)) {
    return left;
  }
  return legalSquares[0] ?? posKey(start);
}
