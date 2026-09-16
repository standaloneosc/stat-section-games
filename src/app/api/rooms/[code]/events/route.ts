import { getRoom, subscribe, toPublicState } from "@/lib/game";
import { noStore } from "@/lib/game/http";
import { readHostTokenFromCookie } from "@/lib/host-cookie";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const room = getRoom(code);
  if (!room) {
    return new Response("Room not found", { status: 404, headers: noStore });
  }
  const url = new URL(request.url);
  const playerId = url.searchParams.get("playerId") ?? undefined;
  const token = url.searchParams.get("token") ?? undefined;
  const hostToken =
    url.searchParams.get("hostToken") ??
    readHostTokenFromCookie(request.headers.get("cookie"), code) ??
    undefined;

  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) {
          return;
        }
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };
      const pushState = (type = "round:state") => {
        const state = toPublicState({
          room,
          playerId,
          playerToken: token,
          hostToken,
        });
        send(type, state);
      };
      pushState();
      const unsubscribe = subscribe(code, (event) => {
        if (event.type === "heartbeat") {
          send("heartbeat", event.payload);
          return;
        }
        pushState(event.type);
      });
      const heartbeat = setInterval(() => {
        const state = toPublicState({
          room,
          playerId,
          playerToken: token,
          hostToken,
        });
        send("heartbeat", {
          remainingMs: state.round?.remainingMs ?? 0,
          status: state.status,
          phase: state.round?.phase ?? "waiting",
        });
      }, 1000);
      const close = () => {
        if (closed) {
          return;
        }
        closed = true;
        unsubscribe();
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      request.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
