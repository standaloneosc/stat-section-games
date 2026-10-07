import { describe, expect, it } from "vitest";
import { applyPayout, clampBet, formatMultiplier, maxAllowedBet, STARTING_BALANCE } from "./payout";

describe("question betting payouts", () => {
  it("starts groups at 10,000 and pays bet × multiplier on a correct lock-in", () => {
    const { nextBalance, delta } = applyPayout(STARTING_BALANCE, 1_000, 2.5, true);
    expect(nextBalance).toBe(11_500);
    expect(delta).toBe(1_500);
  });

  it("subtracts the bet on an incorrect lock-in", () => {
    const { nextBalance, delta } = applyPayout(STARTING_BALANCE, 1_000, 4, false);
    expect(nextBalance).toBe(9_000);
    expect(delta).toBe(-1_000);
  });

  it("allows a zero bet (practice / no stake)", () => {
    expect(applyPayout(STARTING_BALANCE, 0, 3, true).nextBalance).toBe(STARTING_BALANCE);
    expect(applyPayout(STARTING_BALANCE, 0, 3, false).nextBalance).toBe(STARTING_BALANCE);
  });

  it("caps the bet at the current balance and at 10,000", () => {
    expect(maxAllowedBet(4_000)).toBe(4_000);
    expect(maxAllowedBet(25_000)).toBe(10_000);
    expect(() => clampBet(4_001, 4_000)).toThrow(/cannot exceed/);
    expect(clampBet(10_000, 12_000)).toBe(10_000);
  });

  it("labels multipliers as 2x / 2.5x / 3x / 3.5x / 4x before anyone bets", () => {
    expect(formatMultiplier(2)).toBe("2x");
    expect(formatMultiplier(2.5)).toBe("2.5x");
    expect(formatMultiplier(3)).toBe("3x");
    expect(formatMultiplier(3.5)).toBe("3.5x");
    expect(formatMultiplier(4)).toBe("4x");
  });
});
