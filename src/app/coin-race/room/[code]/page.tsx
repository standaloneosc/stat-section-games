import { CoinRacePlayerApp } from "@/components/coin-race/player-app";

export default async function CoinRaceRoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <CoinRacePlayerApp code={code} />;
}
