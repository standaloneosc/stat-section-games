import { describe, expect, it } from "vitest";
import {
  createRoom,
  joinRoom,
  resolveRound,
  startGame,
  submitChoice,
  toPublicState,
} from "./rooms";
import { DEFAULT_COIN_RACE_CONFIG } from "./types";

describe("coin race public state", () => {
  it("hides win probabilities until submissions close", () => {
    const { room } = createRoom({ hostName: "Ms. Park" });
    const { player, token } = joinRoom({ code: room.code, name: "Ava" });
    startGame(room, room.hostToken);
    expect(room.round?.patternA).toBe("HHT");
    expect(room.round?.patternB).toBe("THT");
    expect(room.round?.patternAProbability).toBeCloseTo(0.75, 8);
    const view = toPublicState({
      room,
      playerId: player.id,
      playerToken: token,
    });
    const json = JSON.stringify(view);
    expect(view.round?.phase).toBe("choosing");
    expect(view.round?.resolved).toBeNull();
    expect(json).not.toContain("0.75");
    expect(json).not.toContain("patternAProbability");
    expect(json).not.toMatch(/correctChoice":"A"/);
  });

  it("timestamps speed on the server and still scores 205 if THT appears first", () => {
    const { room } = createRoom({
      hostName: "Host",
      config: { ...DEFAULT_COIN_RACE_CONFIG, decisionTimeSeconds: 180 },
    });
    const { player, token } = joinRoom({ code: room.code, name: "Ben" });
    startGame(room, room.hostToken);
    const round = room.round!;
    round.startedAt = "2026-09-23T18:00:00.000Z";
    round.deadline = "2026-09-23T18:03:00.000Z";
    submitChoice({
      room,
      playerId: player.id,
      token,
      chosenPattern: "A",
      estimatedWinProbability: 0.7,
      bayesEstimate: null,
      confirm: true,
      now: new Date("2026-09-23T18:01:30.000Z"),
    });
    const flips = [0.9, 0.1, 0.9];
    let i = 0;
    resolveRound(room, () => flips[i++] ?? 0.9);
    const result = room.round?.resolved?.results[0];
    expect(room.round?.resolved?.winner).toBe("B");
    expect(result?.score.total).toBe(205);
    expect(result?.score.speedPoints).toBe(25);
    expect(result?.score.correctChoicePoints).toBe(100);
    expect(result?.score.probabilityPoints).toBe(80);
    expect(result?.score.bayesBonus).toBe(0);
  });
});
