import { BettingPlayerApp } from "@/components/betting/player-app";

export default async function BettingRoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <BettingPlayerApp code={code} />;
}
