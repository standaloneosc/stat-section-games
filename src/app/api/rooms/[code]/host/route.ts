import {
  endGame,
  endRoundNow,
  getRoom,
  nextRound,
  pauseGame,
  resumeGame,
  startGame,
  toPublicState,
  updateConfig,
  type GameConfig,
} from "@/lib/game";
import { jsonError, noStore } from "@/lib/game/http";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const room = getRoom(code);
    if (!room) {
      return Response.json({ error: "Room not found. Check the code and try again." }, { status: 404, headers: noStore });
    }
    const body = (await request.json()) as {
      hostToken?: string;
      action?: string;
      config?: Partial<GameConfig>;
    };
    const hostToken = body.hostToken ?? "";
    switch (body.action) {
      case "start":
        startGame(room, hostToken);
        break;
      case "pause":
        pauseGame(room, hostToken);
        break;
      case "resume":
        resumeGame(room, hostToken);
        break;
      case "end-round":
        endRoundNow(room, hostToken);
        break;
      case "next-round":
        nextRound(room, hostToken);
        break;
      case "end-game":
        endGame(room, hostToken);
        break;
      case "update-config":
        updateConfig(room, hostToken, body.config ?? {});
        break;
      default:
        return Response.json({ error: "Unknown host action." }, { status: 400, headers: noStore });
    }
    return Response.json(
      toPublicState({ room, hostToken }),
      { headers: noStore }
    );
  } catch (error) {
    return jsonError(error);
  }
}
