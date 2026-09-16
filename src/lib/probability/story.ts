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
      `Before any clue, the monster notices the class ${asPercent(options.priorNoticed)} of the time.`
    );
  }
  if (options.likelihoodIfNoticed !== null && options.likelihoodIfNotNoticed !== null) {
    if (options.warning) {
      facts.push(
        `When it noticed the class, a warning light happens ${asPercent(options.likelihoodIfNoticed)} of the time.`
      );
      facts.push(
        `When it did not notice you, a warning light still happens ${asPercent(options.likelihoodIfNotNoticed)} of the time (a false alarm).`
      );
    } else {
      facts.push(
        `When it noticed the class, the sensors stay quiet ${asPercent(1 - options.likelihoodIfNoticed)} of the time.`
      );
      facts.push(
        `When it did not notice you, the sensors stay quiet ${asPercent(1 - options.likelihoodIfNotNoticed)} of the time.`
      );
    }
  }
  return facts;
}

export function clueJobLine(clueId: string | null | undefined): string {
  if (clueId === "quiet") {
    return "You are calculating two things. First: given All quiet, how likely the monster noticed the class — P(Alert | All quiet). Then use that to get P(hit this square).";
  }
  return "You are calculating two things. First: given the red warning light, how likely the monster noticed the class — P(Alert | warning light). Then use that to get P(hit this square).";
}

export function alertMoodLine(trait: MonsterTrait): string {
  if (trait === "walker") {
    return "It hunts the middle. It still only stays or steps to a side — corners stay out of range. The center is the most likely square; the four sides split the leftover equally.";
  }
  if (trait === "spider") {
    return "It hunts the middle and may step diagonally. The center is the most likely legal square; the others split the leftover equally.";
  }
  return "It hunts the middle. The center is the most likely legal square when it is in range; the others split the leftover equally.";
}

export function calmMoodLine(): string {
  return "It mixes the habits in the table: stay, side steps, or wander.";
}
