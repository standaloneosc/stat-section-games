import { getRoom, submitAnswer, toPublicState, type PlayerAnswer } from "@/lib/betting";
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
      return Response.json(
        { error: "Room not found. Check the code and try again." },
        { status: 404, headers: noStore }
      );
    }
    const body = (await request.json()) as {
      playerId?: string;
      token?: string;
      bet?: number;
      answer?: PlayerAnswer;
      confirm?: boolean;
    };
    submitAnswer({
      room,
      playerId: body.playerId ?? "",
      token: body.token ?? "",
      bet: body.bet ?? 0,
      answer: body.answer ?? {},
      confirm: body.confirm ?? true,
    });
    return Response.json(
      toPublicState({
        room,
        playerId: body.playerId,
        playerToken: body.token,
      }),
      { headers: noStore }
    );
  } catch (error) {
    return jsonError(error);
  }
}
