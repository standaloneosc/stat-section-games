import type { MonsterTrait } from "./types";

export const WARNING_CLUE_TEXT = "A red warning light flashed on the wall.";
export const QUIET_CLUE_TEXT = "The sensors stayed quiet. No warning light.";

export function timesOutOf100(probability: number): string {
  const n = Math.round(probability * 100);
  return `${n} time${n === 1 ? "" : "s"} out of 100`;
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
      `Before any clue, the monster notices the class ${timesOutOf100(options.priorNoticed)}.`
    );
  }
  if (options.likelihoodIfNoticed !== null && options.likelihoodIfNotNoticed !== null) {
    if (options.warning) {
      facts.push(
        `When it noticed the class, a warning light happens ${timesOutOf100(options.likelihoodIfNoticed)}.`
      );
      facts.push(
        `When it did not notice you, a warning light still happens ${timesOutOf100(options.likelihoodIfNotNoticed)} (a false alarm).`
      );
    } else {
      facts.push(
        `When it noticed the class, the sensors stay quiet ${timesOutOf100(1 - options.likelihoodIfNoticed)}.`
      );
      facts.push(
        `When it did not notice you, the sensors stay quiet ${timesOutOf100(1 - options.likelihoodIfNotNoticed)}.`
      );
    }
  }
  return facts;
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
