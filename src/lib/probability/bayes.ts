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

export function clueIsWarning(clueId: string | null | undefined): boolean {
  return clueId === "warning";
}

export const WARNING_CLUE_TEXT = "A red warning light appeared.";
export const QUIET_CLUE_TEXT = "The sensors stayed quiet. No warning light appeared.";

export function clueText(clueId: string | null | undefined): string {
  if (clueId === "quiet") {
    return QUIET_CLUE_TEXT;
  }
  return WARNING_CLUE_TEXT;
}
