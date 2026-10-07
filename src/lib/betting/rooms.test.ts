import { describe, expect, it } from "vitest";
import {
  adjustBalance,
  createRoom,
  joinRoom,
  revealQuestion,
  startGame,
  submitAnswer,
  toPublicState,
} from "./rooms";

describe("betting rooms", () => {
  it("publishes the multiplier on the open question before anyone locks in", () => {
    const { room } = createRoom({ hostName: "Oscar" });
    const { player, token } = joinRoom({ code: room.code, name: "Table A" });
    startGame(room, room.hostToken, 12);
    const view = toPublicState({ room, playerId: player.id, playerToken: token });
    expect(view.current?.id).toBe(12);
    expect(view.current?.multiplier).toBe(3.5);
    expect(view.current?.multiplierLabel).toBe("3.5x");
    expect(view.current?.revealed).toBeNull();
    expect(JSON.stringify(view.current)).not.toContain("correctKey");
    expect(view.catalog.every((item) => item.multiplierLabel.endsWith("x"))).toBe(true);
    expect(view.you?.balance).toBe(10_000);
  });

  it("pays a correct 2.5x bet from 10k and updates the live leaderboard", () => {
    const { room } = createRoom({ hostName: "Host" });
    const a = joinRoom({ code: room.code, name: "Aces" });
    const b = joinRoom({ code: room.code, name: "Kings" });
    startGame(room, room.hostToken, 1);
    submitAnswer({
      room,
      playerId: a.player.id,
      token: a.token,
      bet: 2_000,
      answer: { numericText: "5/16" },
    });
    submitAnswer({
      room,
      playerId: b.player.id,
      token: b.token,
      bet: 2_000,
      answer: { numericText: "0.9" },
    });
    revealQuestion(room, room.hostToken);
    const view = toPublicState({ room, hostToken: room.hostToken });
    const aces = view.leaderboard.find((row) => row.name === "Aces");
    const kings = view.leaderboard.find((row) => row.name === "Kings");
    expect(aces?.balance).toBe(13_000);
    expect(kings?.balance).toBe(8_000);
    expect(view.leaderboard[0]?.name).toBe("Aces");
    expect(view.current?.revealed?.correctKey).toContain("5/16");
  });

  it("lets the host give or take points from a group", () => {
    const { room } = createRoom({ hostName: "Host" });
    const { player } = joinRoom({ code: room.code, name: "Sparks" });
    adjustBalance({ room, hostToken: room.hostToken, playerId: player.id, amount: -500, note: "late" });
    expect(player.balance).toBe(9_500);
    const view = toPublicState({ room, hostToken: room.hostToken });
    expect(view.balanceLog[0]?.amount).toBe(-500);
    expect(view.leaderboard[0]?.balance).toBe(9_500);
  });
});
