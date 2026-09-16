import { HostApp } from "@/components/game/host-app";

export default async function HostPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <HostApp code={code} />;
}
