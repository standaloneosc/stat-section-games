import { cookies } from "next/headers";
import { CoinRaceHostApp } from "@/components/coin-race/host-app";
import { getRoom, toPublicState } from "@/lib/coin-race";
import { coinRaceHostCookieName } from "@/lib/host-cookie";

export const dynamic = "force-dynamic";

export default async function CoinRaceHostPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(coinRaceHostCookieName(code))?.value ?? null;
  const room = getRoom(code);
  const initialState =
    room && cookieToken ? toPublicState({ room, hostToken: cookieToken }) : null;
  return <CoinRaceHostApp code={code} cookieToken={cookieToken} initialState={initialState} />;
}
