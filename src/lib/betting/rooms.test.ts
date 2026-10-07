import { describe, expect, it } from "vitest";
import {
  adjustBalance,
  createRoom,
  endGame,
  joinRoom,
  startGame,
  submitAnswer,
  toPublicState,
  updateConfig,
} from "./rooms";

describe("betting rooms — open grid", () => {
  it("lists every question with its multiplier before anyone bets", () => {
    const { room } = createRoom({ hostName: "Oscar" });
    const { player, token } = joinRoom({ code: room.code, name: "Table A" });
    startGame(room, room.hostToken);
    const view = toPublicState({ room, playerId: player.id, playerToken: token });
    expect(view.grid).toHaveLength(15);
    expect(view.grid.every((item) => item.multiplierLabel.endsWith("x"))).toBe(true);
    expect(view.grid.find((item) => item.id === 12)?.multiplierLabel).toBe("3.5x");
    expect(view.grid.every((item) => item.yourResult === null)).toBe(true);
    expect(view.frozen).toBe(false);
    expect(view.you?.balance).toBe(10_000);
  });

  it("lets a group bet on any question immediately and pays out on lock-in", () => {
    const { room } = createRoom({ hostName: "Host" });
    const a = joinRoom({ code: room.code, name: "Aces" });
    const b = joinRoom({ code: room.code, name: "Kings" });
    startGame(room, room.hostToken);
    submitAnswer({
      room,
      playerId: a.player.id,
      token: a.token,
      questionId: 1,
      bet: 2_000,
      answer: { numericText: "5/16" },
    });
    submitAnswer({
      room,
      playerId: b.player.id,
      token: b.token,
      questionId: 15,
      bet: 2_000,
      answer: { numericText: "0" },
    });
    const view = toPublicState({ room, playerId: a.player.id, playerToken: a.token });
    expect(view.you?.balance).toBe(13_000);
    expect(view.grid.find((item) => item.id === 1)?.yourResult?.correct).toBe(true);
    expect(view.leaderboard[0]?.name).toBe("Aces");
    expect(view.leaderboard.find((row) => row.name === "Kings")?.balance).toBe(8_000);
    expect(() =>
      submitAnswer({
        room,
        playerId: a.player.id,
        token: a.token,
        questionId: 1,
        bet: 100,
        answer: { numericText: "5/16" },
      })
    ).toThrow(/already locked in/);
  });

  it("freezes balances when the host ends the clock", () => {
    const { room } = createRoom({ hostName: "Host" });
    const { player, token } = joinRoom({ code: room.code, name: "Sparks" });
    startGame(room, room.hostToken);
    endGame(room, room.hostToken);
    const view = toPublicState({ room, playerId: player.id, playerToken: token });
    expect(view.frozen).toBe(true);
    expect(view.remainingMs).toBe(0);
    expect(() =>
      submitAnswer({
        room,
        playerId: player.id,
        token,
        questionId: 5,
        bet: 0,
        answer: { numericText: "14.7" },
      })
    ).toThrow(/not open/);
  });

  it("lets the host set the time limit in the lobby and give or take points", () => {
    const { room } = createRoom({ hostName: "Host" });
    const { player } = joinRoom({ code: room.code, name: "Sparks" });
    const config = updateConfig(room, room.hostToken, { timeLimitSeconds: 1200 });
    expect(config.timeLimitSeconds).toBe(1200);
    adjustBalance({ room, hostToken: room.hostToken, playerId: player.id, amount: -500, note: "late" });
    expect(player.balance).toBe(9_500);
  });
});
