import { bayesLikelihoodsAreUsable } from "@/lib/probability";

export const DEFAULT_ALERT_PERCENT = 40;
export const DEFAULT_WARNING_GIVEN_ALERT_PERCENT = 80;
export const DEFAULT_WARNING_GIVEN_CALM_PERCENT = 20;

export const UNUSABLE_BAYES_MESSAGE =
  "Those Alert percents make a warning or a quiet clue impossible, so Bayes cannot be scored. P(warning | Alert) and P(warning | Calm) cannot both be 0% or both be 100%.";

/** Accept a 0–1 probability or a 0–100 percent. */
export function parseUnitInterval(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a number from 0 to 100.`);
  }
  if (value < 0 || value > 100) {
    throw new Error(`${label} must be between 0 and 100.`);
  }
  return value > 1 ? value / 100 : value;
}

export function percentFromProbability(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(Math.min(1, Math.max(0, value)) * 100);
}

export function bayesPercentError(
  alertPercent: number,
  warningIfAlertPercent: number,
  warningIfCalmPercent: number
): string | null {
  const fields: Array<[string, number]> = [
    ["P(Alert)", alertPercent],
    ["P(warning | Alert)", warningIfAlertPercent],
    ["P(warning | Calm)", warningIfCalmPercent],
  ];
  for (const [label, value] of fields) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      return `${label} must be between 0 and 100.`;
    }
  }
  const prior = alertPercent / 100;
  const warningIfAlert = warningIfAlertPercent / 100;
  const warningIfCalm = warningIfCalmPercent / 100;
  if (!bayesLikelihoodsAreUsable(prior, warningIfAlert, warningIfCalm)) {
    return UNUSABLE_BAYES_MESSAGE;
  }
  return null;
}
