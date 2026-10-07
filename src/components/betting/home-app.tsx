"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveBettingHostSession, saveBettingPlayerSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export function BettingHomeApp() {
  const router = useRouter();
  const [hostName, setHostName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"host" | "join" | null>(null);
  const requestLock = useRef(false);

  async function createRoom(event?: React.FormEvent | React.MouseEvent) {
    event?.preventDefault();
    if (requestLock.current) return;
    requestLock.current = true;
    setBusy("host");
    setError(null);
    try {
      const response = await fetch("/api/betting/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: hostName || "Host" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not create a room.");
      saveBettingHostSession(data.code, data.hostToken);
      router.push(data.hostPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create a room.");
    } finally {
      requestLock.current = false;
      setBusy(null);
    }
  }

  async function joinRoom(event?: React.FormEvent | React.MouseEvent) {
    event?.preventDefault();
    if (requestLock.current) return;
    requestLock.current = true;
    setBusy("join");
    setError(null);
    const code = joinCode.trim().toUpperCase();
    try {
      const response = await fetch(`/api/betting/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: joinName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not join that room.");
      saveBettingPlayerSession(code, {
        playerId: data.playerId,
        token: data.token,
        name: data.name,
      });
      router.push(`/betting/room/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join.");
    } finally {
      requestLock.current = false;
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-4 py-10">
      <header className="space-y-3">
        <p className="text-xs tracking-[0.2em] text-amber-200/80 uppercase">
          <Link href="/" className="hover:underline">
            Stat section games
          </Link>
          {" · "}Question betting
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Bet on the answer
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          Fifteen interview questions in a grid. Each cell shows its multiplier. Groups start at
          10,000 and bet on any question while the host clock runs. Final score is the balance
          when time hits zero.
        </p>
      </header>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Host a class</CardTitle>
            <CardDescription>
              Set the time limit, start the clock, watch the live leaderboard, and give or take
              points.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              method="post"
              action="/api/betting/rooms"
              onSubmit={(event) => void createRoom(event)}
            >
              <div className="grid gap-2">
                <Label htmlFor="qbg-host-name">Your name (optional)</Label>
                <Input
                  id="qbg-host-name"
                  name="name"
                  value={hostName}
                  onChange={(event) => setHostName(event.target.value)}
                  placeholder="Ms. Park"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={busy !== null}
              >
                {busy === "host" ? "Creating…" : "Create room"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Join a group</CardTitle>
            <CardDescription>Enter your group name and the four-character room code.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={(event) => void joinRoom(event)}>
              <div className="grid gap-2">
                <Label htmlFor="qbg-join-name">Group name</Label>
                <Input
                  id="qbg-join-name"
                  value={joinName}
                  onChange={(event) => setJoinName(event.target.value)}
                  placeholder="Table 3"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="qbg-join-code">Room code</Label>
                <Input
                  id="qbg-join-code"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  maxLength={4}
                  className="font-mono uppercase"
                />
              </div>
              <Button
                type="submit"
                className={cn("w-full", buttonVariants({ variant: "secondary" }))}
                disabled={busy !== null || joinName.trim().length < 1 || joinCode.trim().length < 4}
              >
                {busy === "join" ? "Joining…" : "Join"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Practice alone</CardTitle>
            <CardDescription>
              Untimed grid with a fake 10,000. Every cell still shows its multiplier before you
              bet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/betting/practice" className="block">
              <Button className="w-full" variant="secondary">
                Open practice
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
