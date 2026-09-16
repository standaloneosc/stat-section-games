import { createRoom, type GameConfig } from "@/lib/game";
import { jsonError, noStore } from "@/lib/game/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      config?: Partial<GameConfig>;
    };
    const name = body.name?.trim() ?? "Host";
    const { room, hostId, hostToken } = createRoom({
      hostName: name,
      config: body.config,
    });
    return Response.json(
      {
        code: room.code,
        hostId,
        hostToken,
        joinPath: `/room/${room.code}`,
        hostPath: `/room/${room.code}/host`,
      },
      { headers: noStore }
    );
  } catch (error) {
    return jsonError(error);
  }
}
