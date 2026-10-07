import { cookies } from "next/headers";
import { BettingHostApp } from "@/components/betting/host-app";
import { getRoom, toPublicState } from "@/lib/betting";
import { bettingHostCookieName } from "@/lib/host-cookie";

export const dynamic = "force-dynamic";

export default async function BettingHostPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(bettingHostCookieName(code))?.value ?? null;
  const room = getRoom(code);
  const initialState =
    room && cookieToken ? toPublicState({ room, hostToken: cookieToken }) : null;
  return <BettingHostApp code={code} cookieToken={cookieToken} initialState={initialState} />;
}
