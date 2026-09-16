import { getRoom, toPublicState } from "@/lib/game";
import { jsonError, noStore } from "@/lib/game/http";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const room = getRoom(code);
    if (!room) {
      return Response.json({ error: "Room not found. Check the code and try again." }, { status: 404, headers: noStore });
    }
    const url = new URL(request.url);
    const state = toPublicState({
      room,
      playerId: url.searchParams.get("playerId") ?? undefined,
      playerToken: url.searchParams.get("token") ?? undefined,
      hostToken: url.searchParams.get("hostToken") ?? undefined,
    });
    return Response.json(state, { headers: noStore });
  } catch (error) {
    return jsonError(error);
  }
}
