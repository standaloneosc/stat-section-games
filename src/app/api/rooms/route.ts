import { createRoom, type GameConfig } from "@/lib/game";
import { jsonError, noStore } from "@/lib/game/http";
import { hostCookieHeader } from "@/lib/host-cookie";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");
    let name = "Host";
    let config: Partial<GameConfig> | undefined;

    if (isJson) {
      const body = (await request.json()) as {
        name?: string;
        config?: Partial<GameConfig>;
      };
      name = body.name?.trim() || "Host";
      config = body.config;
    } else {
      const form = await request.formData();
      name = String(form.get("name") ?? "").trim() || "Host";
    }

    const { room, hostId, hostToken } = createRoom({
      hostName: name,
      config,
    });
    const cookie = hostCookieHeader(room.code, hostToken);
    const headers = {
      ...noStore,
      "Set-Cookie": cookie,
    };

    if (!isJson) {
      return new Response(null, {
        status: 303,
        headers: {
          ...headers,
          Location: `/room/${room.code}/host`,
        },
      });
    }

    return Response.json(
      {
        code: room.code,
        hostId,
        hostToken,
        joinPath: `/room/${room.code}`,
        hostPath: `/room/${room.code}/host`,
      },
      { headers }
    );
  } catch (error) {
    return jsonError(error);
  }
}
