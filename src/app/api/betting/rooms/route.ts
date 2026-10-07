import { createRoom, type BettingConfig } from "@/lib/betting";
import { jsonError, noStore } from "@/lib/game/http";
import { bettingHostCookieHeader } from "@/lib/host-cookie";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");
    let name = "Host";
    let config: Partial<BettingConfig> | undefined;

    if (isJson) {
      const body = (await request.json()) as {
        name?: string;
        config?: Partial<BettingConfig>;
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
    const cookie = bettingHostCookieHeader(room.code, hostToken);
    const headers = {
      ...noStore,
      "Set-Cookie": cookie,
    };

    if (!isJson) {
      return new Response(null, {
        status: 303,
        headers: {
          ...headers,
          Location: `/betting/room/${room.code}/host`,
        },
      });
    }

    return Response.json(
      {
        code: room.code,
        hostId,
        hostToken,
        joinPath: `/betting/room/${room.code}`,
        hostPath: `/betting/room/${room.code}/host`,
      },
      { headers }
    );
  } catch (error) {
    return jsonError(error);
  }
}
