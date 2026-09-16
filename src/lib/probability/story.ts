import type { MonsterTrait } from "./types";

export const WARNING_CLUE_TEXT = "A red warning light flashed on the wall.";
export const QUIET_CLUE_TEXT = "The sensors stayed quiet. No warning light.";

export function asPercent(probability: number): string {
  return `${Math.round(probability * 100)}%`;
}

export function clueSight(clueId: string | null | undefined): {
  title: string;
  seen: string;
} {
  if (clueId === "quiet") {
    return {
      title: "All quiet",
      seen: "You can see it: the sensors stayed dark. No warning light.",
    };
  }
  return {
    title: "Red warning light",
    seen: "You can see it: a red warning light flashed on the wall.",
  };
}

export function clueWorldFacts(options: {
  priorNoticed: number | null;
  likelihoodIfNoticed: number | null;
  likelihoodIfNotNoticed: number | null;
  warning: boolean;
}): string[] {
  const facts: string[] = [];
  if (options.priorNoticed !== null) {
    facts.push(
      `The monster notices the class ${asPercent(options.priorNoticed)} of the time (before any clue).`
    );
  }
  if (options.likelihoodIfNoticed !== null && options.likelihoodIfNotNoticed !== null) {
    if (options.warning) {
      facts.push(
        `If Alert, the light is on ${asPercent(options.likelihoodIfNoticed)} of the time.`
      );
      facts.push(
        `If Calm, the light is on ${asPercent(options.likelihoodIfNotNoticed)} of the time.`
      );
    } else {
      facts.push(
        `If Alert, the light is off ${asPercent(1 - options.likelihoodIfNoticed)} of the time.`
      );
      facts.push(
        `If Calm, the light is off ${asPercent(1 - options.likelihoodIfNotNoticed)} of the time.`
      );
    }
  }
  return facts;
}

export function clueJobLine(_clueId?: string | null): string {
  return "You are calculating P(Alert | this clue), then P(hit this square).";
}

export function alertMoodLine(trait: MonsterTrait): string {
  if (trait === "walker") {
    return "It hunts the middle on the same legal squares (no corners). Use the Alert table.";
  }
  if (trait === "spider") {
    return "It hunts the middle and may step diagonally. Use the Alert table.";
  }
  return "It hunts the middle when that square is in range. Use the Alert table.";
}

export function calmMoodLine(): string {
  return "It mixes stay, side steps, or wander. Use the Calm table.";
}
