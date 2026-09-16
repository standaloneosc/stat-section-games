import { describe, expect, it } from "vitest";
import {
  alertMoodLine,
  clueSight,
  clueWorldFacts,
  noticedMotionBlurb,
  timesOutOf100,
} from "./index";

describe("player-facing noticed story", () => {
  it("says times out of 100 instead of a raw percent table", () => {
    expect(timesOutOf100(0.4)).toBe("40 times out of 100");
    expect(timesOutOf100(0.8)).toBe("80 times out of 100");
    expect(timesOutOf100(0.2)).toBe("20 times out of 100");
  });

  it("makes the warning light something you can see", () => {
    const sight = clueSight("warning");
    expect(sight.title).toBe("Red warning light");
    expect(sight.seen.toLowerCase()).toContain("red warning light");
    expect(sight.seen.toLowerCase()).not.toContain("posterior");
  });

  it("gives Bayes inputs as world facts, not the posterior", () => {
    const facts = clueWorldFacts({
      priorNoticed: 0.4,
      likelihoodIfNoticed: 0.8,
      likelihoodIfNotNoticed: 0.2,
      warning: true,
    }).join(" ");
    expect(facts).toContain("40 times out of 100");
    expect(facts).toContain("80 times out of 100");
    expect(facts).toContain("20 times out of 100");
    expect(facts).toContain("false alarm");
    expect(facts).not.toMatch(/72|0\.727|posterior|6 shares/);
  });

  it("describes Alert as hunting the middle without share-counts", () => {
    const line = alertMoodLine("walker");
    expect(line.toLowerCase()).toContain("hunts the middle");
    expect(line.toLowerCase()).toContain("corners");
    expect(line).not.toMatch(/6 shares|6 parts|posterior/);
    expect(noticedMotionBlurb("walker")).toBe(line);
  });
});
