import { describe, expect, it } from "vitest";
import {
  alertMoodLine,
  asPercent,
  clueJobLine,
  clueWorldFacts,
  noticedMotionBlurb,
} from "./index";

describe("player-facing noticed story", () => {
  it("prints percents, not times out of 100", () => {
    expect(asPercent(0.4)).toBe("40%");
    expect(asPercent(0.8)).toBe("80%");
    expect(asPercent(0.2)).toBe("20%");
  });

  it("gives warning (light on) Bayes inputs as percents, not the posterior", () => {
    const facts = clueWorldFacts({
      priorNoticed: 0.4,
      likelihoodIfNoticed: 0.8,
      likelihoodIfNotNoticed: 0.2,
      warning: true,
    });
    expect(facts).toEqual([
      "The monster notices the class 40% of the time (before any clue).",
      "If Alert, the light is on 80% of the time.",
      "If Calm, the light is on 20% of the time.",
    ]);
    expect(facts.join(" ")).not.toMatch(/14%|29%|18%|72|0\.727|posterior|sensors stayed/);
  });

  it("gives quiet (light off) Bayes inputs as percents, not the posterior", () => {
    const facts = clueWorldFacts({
      priorNoticed: 0.4,
      likelihoodIfNoticed: 0.8,
      likelihoodIfNotNoticed: 0.2,
      warning: false,
    });
    expect(facts).toEqual([
      "The monster notices the class 40% of the time (before any clue).",
      "If Alert, the light is off 20% of the time.",
      "If Calm, the light is off 80% of the time.",
    ]);
    expect(facts.join(" ")).not.toMatch(/14%|29%|18%|you can see/i);
  });

  it("prints the current host percents, not hardcoded 40/80/20", () => {
    const facts = clueWorldFacts({
      priorNoticed: 0.25,
      likelihoodIfNoticed: 0.9,
      likelihoodIfNotNoticed: 0.1,
      warning: true,
    });
    expect(facts).toEqual([
      "The monster notices the class 25% of the time (before any clue).",
      "If Alert, the light is on 90% of the time.",
      "If Calm, the light is on 10% of the time.",
    ]);
    expect(facts.join(" ")).not.toMatch(/\b40%|\b80%|\b20%/);
  });

  it("names the two calculation targets without spoiling answers", () => {
    expect(clueJobLine()).toBe(
      "You are calculating P(Alert | this clue), then P(hit this square)."
    );
    expect(clueJobLine()).not.toMatch(/14%|29%|18%/);
  });

  it("describes Alert as hunting the middle without share-counts", () => {
    const line = alertMoodLine("walker");
    expect(line.toLowerCase()).toContain("hunts the middle");
    expect(line).not.toMatch(/6 shares|6 parts|posterior/);
    expect(noticedMotionBlurb("walker")).toBe(line);
  });
});
