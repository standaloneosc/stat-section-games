import { PlayerApp } from "@/components/game/player-app";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <PlayerApp code={code} />;
}
