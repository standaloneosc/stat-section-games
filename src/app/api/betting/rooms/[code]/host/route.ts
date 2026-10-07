import {
  adjustBalance,
  endGame,
  getRoom,
  nextQuestion,
  pauseGame,
  resumeGame,
  revealQuestion,
  startGame,
  toPublicState,
  updateConfig,
  type BettingConfig,
} from "@/lib/betting";
import { jsonError, noStore } from "@/lib/game/http";
import { readBettingHostTokenFromCookie } from "@/lib/host-cookie";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const room = getRoom(code);
    if (!room) {
      return Response.json(
        { error: "Room not found. Check the code and try again." },
        { status: 404, headers: noStore }
      );
    }
    const body = (await request.json()) as {
      hostToken?: string;
      action?: string;
      questionId?: number;
      playerId?: string;
      amount?: number;
      note?: string;
      config?: Partial<BettingConfig>;
    };
    const hostToken =
      body.hostToken ||
      readBettingHostTokenFromCookie(request.headers.get("cookie"), code) ||
      "";
    switch (body.action) {
      case "start":
        startGame(room, hostToken, body.questionId);
        break;
      case "pause":
        pauseGame(room, hostToken);
        break;
      case "resume":
        resumeGame(room, hostToken);
        break;
      case "reveal":
        revealQuestion(room, hostToken);
        break;
      case "next":
        nextQuestion(room, hostToken, body.questionId);
        break;
      case "open-question":
        nextQuestion(room, hostToken, body.questionId);
        break;
      case "end-game":
        endGame(room, hostToken);
        break;
      case "adjust-balance":
        adjustBalance({
          room,
          hostToken,
          playerId: body.playerId ?? "",
          amount: body.amount ?? 0,
          note: body.note,
        });
        break;
      case "update-config":
        updateConfig(room, hostToken, body.config ?? {});
        break;
      default:
        return Response.json({ error: "Unknown host action." }, { status: 400, headers: noStore });
    }
    return Response.json(toPublicState({ room, hostToken }), { headers: noStore });
  } catch (error) {
    return jsonError(error);
  }
}
