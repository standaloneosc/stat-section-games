import { QUIET_CLUE_TEXT, WARNING_CLUE_TEXT } from "./story";

const EVIDENCE_EPSILON = 1e-12;

export function calculateBayesPosterior(
  prior: number,
  likelihoodIfTrue: number,
  likelihoodIfFalse: number,
  evidenceObserved: boolean
): number {
  if (prior < 0 || prior > 1) {
    throw new Error("Prior must be between 0 and 1");
  }
  const pEvidenceGivenTrue = evidenceObserved
    ? likelihoodIfTrue
    : 1 - likelihoodIfTrue;
  const pEvidenceGivenFalse = evidenceObserved
    ? likelihoodIfFalse
    : 1 - likelihoodIfFalse;
  const numerator = pEvidenceGivenTrue * prior;
  const denominator =
    numerator + pEvidenceGivenFalse * (1 - prior);
  if (denominator <= 0) {
    throw new Error("Evidence has probability 0 under the given model");
  }
  return numerator / denominator;
}

export function evidenceProbability(
  prior: number,
  likelihoodIfTrue: number,
  likelihoodIfFalse: number,
  evidenceObserved: boolean
): number {
  const pEvidenceGivenTrue = evidenceObserved
    ? likelihoodIfTrue
    : 1 - likelihoodIfTrue;
  const pEvidenceGivenFalse = evidenceObserved
    ? likelihoodIfFalse
    : 1 - likelihoodIfFalse;
  return pEvidenceGivenTrue * prior + pEvidenceGivenFalse * (1 - prior);
}

/** Both a warning and a quiet clue must be possible so Bayes has a denominator. */
export function bayesLikelihoodsAreUsable(
  prior: number,
  warningIfAlert: number,
  warningIfCalm: number
): boolean {
  const pWarning = evidenceProbability(prior, warningIfAlert, warningIfCalm, true);
  const pQuiet = evidenceProbability(prior, warningIfAlert, warningIfCalm, false);
  return pWarning > EVIDENCE_EPSILON && pQuiet > EVIDENCE_EPSILON;
}

export function clueIsWarning(clueId: string | null | undefined): boolean {
  return clueId === "warning";
}

export { QUIET_CLUE_TEXT, WARNING_CLUE_TEXT };

export function clueText(clueId: string | null | undefined): string {
  if (clueId === "quiet") {
    return QUIET_CLUE_TEXT;
  }
  return WARNING_CLUE_TEXT;
}
