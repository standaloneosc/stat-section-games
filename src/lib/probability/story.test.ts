import { describe, expect, it } from "vitest";
import {
  alertMoodLine,
  asPercent,
  clueJobLine,
  clueSight,
  clueWorldFacts,
  noticedMotionBlurb,
} from "./index";

describe("player-facing noticed story", () => {
  it("prints percents, not times out of 100", () => {
    expect(asPercent(0.4)).toBe("40%");
    expect(asPercent(0.8)).toBe("80%");
    expect(asPercent(0.2)).toBe("20%");
  });

  it("makes the warning light something you can see", () => {
    const sight = clueSight("warning");
    expect(sight.title).toBe("Red warning light");
    expect(sight.seen.toLowerCase()).toContain("red warning light");
    expect(sight.seen.toLowerCase()).not.toContain("posterior");
  });

  it("gives warning-light Bayes inputs as percents, not the posterior", () => {
    const facts = clueWorldFacts({
      priorNoticed: 0.4,
      likelihoodIfNoticed: 0.8,
      likelihoodIfNotNoticed: 0.2,
      warning: true,
    });
    expect(facts).toEqual([
      "Before any clue, the monster notices the class 40% of the time.",
      "When it noticed the class, a warning light happens 80% of the time.",
      "When it did not notice you, a warning light still happens 20% of the time (a false alarm).",
    ]);
    expect(facts.join(" ")).not.toMatch(/14%|29%|18%|72|0\.727|posterior|times out of 100/);
  });

  it("gives all-quiet Bayes inputs as percents, not the posterior", () => {
    const facts = clueWorldFacts({
      priorNoticed: 0.4,
      likelihoodIfNoticed: 0.8,
      likelihoodIfNotNoticed: 0.2,
      warning: false,
    });
    expect(facts).toEqual([
      "Before any clue, the monster notices the class 40% of the time.",
      "When it noticed the class, the sensors stay quiet 20% of the time.",
      "When it did not notice you, the sensors stay quiet 80% of the time.",
    ]);
    expect(facts.join(" ")).not.toMatch(/14%|29%|18%|times out of 100/);
  });

  it("names the two calculation targets for each clue", () => {
    expect(clueJobLine("quiet")).toBe(
      "You are calculating two things. First: given All quiet, how likely the monster noticed the class — P(Alert | All quiet). Then use that to get P(hit this square)."
    );
    expect(clueJobLine("warning")).toBe(
      "You are calculating two things. First: given the red warning light, how likely the monster noticed the class — P(Alert | warning light). Then use that to get P(hit this square)."
    );
    expect(clueJobLine("quiet")).not.toMatch(/14%|29%|18%/);
    expect(clueJobLine("warning")).not.toMatch(/14%|29%|18%/);
  });

  it("describes Alert as hunting the middle without share-counts", () => {
    const line = alertMoodLine("walker");
    expect(line.toLowerCase()).toContain("hunts the middle");
    expect(line.toLowerCase()).toContain("corners");
    expect(line).not.toMatch(/6 shares|6 parts|posterior/);
    expect(noticedMotionBlurb("walker")).toBe(line);
  });
});
