import { joinRoom, toPublicState } from "@/lib/game";
import { jsonError, noStore } from "@/lib/game/http";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const body = (await request.json()) as {
      name?: string;
      playerId?: string;
      token?: string;
    };
    const { room, player } = joinRoom({
      code,
      name: body.name ?? "",
      playerId: body.playerId,
      token: body.token,
    });
    return Response.json(
      {
        playerId: player.id,
        token: player.token,
        name: player.name,
        code: room.code,
        state: toPublicState({
          room,
          playerId: player.id,
          playerToken: player.token,
        }),
      },
      { headers: noStore }
    );
  } catch (error) {
    return jsonError(error);
  }
}
