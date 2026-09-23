import { getRoom, submitChoice, toPublicState, type PatternChoice } from "@/lib/coin-race";
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
      chosenPattern?: PatternChoice;
      estimatedWinPercent?: number;
      estimatedWinProbability?: number;
      bayesPercent?: number | null;
      bayesEstimate?: number | null;
      confirm?: boolean;
    };
    const estimate =
      body.estimatedWinProbability ??
      (typeof body.estimatedWinPercent === "number" ? body.estimatedWinPercent / 100 : NaN);
    const bayes =
      body.bayesEstimate ??
      (typeof body.bayesPercent === "number" ? body.bayesPercent / 100 : null);
    submitChoice({
      room,
      playerId: body.playerId ?? "",
      token: body.token ?? "",
      chosenPattern: body.chosenPattern ?? "A",
      estimatedWinProbability: estimate,
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
