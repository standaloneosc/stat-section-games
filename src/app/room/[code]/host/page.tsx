import { cookies } from "next/headers";
import { HostApp } from "@/components/game/host-app";
import { getRoom, toPublicState } from "@/lib/game";
import { hostCookieName } from "@/lib/host-cookie";

export const dynamic = "force-dynamic";

export default async function HostPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(hostCookieName(code))?.value ?? null;
  const room = getRoom(code);
  const initialState =
    room && cookieToken ? toPublicState({ room, hostToken: cookieToken }) : null;
  return <HostApp code={code} cookieToken={cookieToken} initialState={initialState} />;
}
