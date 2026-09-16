import { getRoom, submitChoice, toPublicState } from "@/lib/game";
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
      playerId?: string;
      token?: string;
      selectedSquare?: string;
      estimatedHitProbability?: number;
      estimatedHitPercent?: number;
      bayesEstimate?: number | null;
      bayesPercent?: number | null;
      confirm?: boolean;
    };
    const hit =
      body.estimatedHitProbability ??
      (typeof body.estimatedHitPercent === "number" ? body.estimatedHitPercent / 100 : NaN);
    const bayes =
      body.bayesEstimate ??
      (typeof body.bayesPercent === "number" ? body.bayesPercent / 100 : null);
    submitChoice({
      room,
      playerId: body.playerId ?? "",
      token: body.token ?? "",
      selectedSquare: body.selectedSquare ?? "",
      estimatedHitProbability: hit,
      bayesEstimate: bayes,
      confirm: Boolean(body.confirm),
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
