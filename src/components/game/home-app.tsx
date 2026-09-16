"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveHostSession, savePlayerSession } from "@/lib/session";

export function HomeApp() {
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
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: hostName || "Host" }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Could not create a room.");
      }
      saveHostSession(data.code, data.hostToken);
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
      const response = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: joinName }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Could not join that room.");
      }
      savePlayerSession(code, {
        playerId: data.playerId,
        token: data.token,
        name: data.name,
      });
      router.push(`/room/${code}`);
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
        <p className="text-xs tracking-[0.2em] text-amber-200/80 uppercase">Classroom probability</p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Hide from the monster. Divide the reward. Show your work.
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          A 3×3 hide-and-seek game for teaching the law of total probability and Bayes&apos; rule.
          Players hide on legal squares while a Walker, Spider, or Hunter moves locally. Survival
          points split with anyone who picked the same square.
        </p>
      </header>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Host a class</CardTitle>
            <CardDescription>Create a room code, then start, pause, and end rounds from the teacher desk.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={(event) => void createRoom(event)}>
              <div className="grid gap-2">
                <Label htmlFor="host-name">Your name (optional)</Label>
                <Input
                  id="host-name"
                  value={hostName}
                  placeholder="Ms. Park"
                  onChange={(event) => setHostName(event.target.value)}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={busy !== null}
                onClick={(event) => void createRoom(event)}
              >
                {busy === "host" ? "Creating…" : "Create room"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Join a room</CardTitle>
            <CardDescription>Use the four-character code on the board. Open each player in its own tab.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={(event) => void joinRoom(event)}>
              <div className="grid gap-2">
                <Label htmlFor="join-name">Display name</Label>
                <Input
                  id="join-name"
                  value={joinName}
                  placeholder="Jordan"
                  onChange={(event) => setJoinName(event.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="code">Room code</Label>
                <Input
                  id="code"
                  value={joinCode}
                  placeholder="K7MP"
                  className="uppercase"
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={busy !== null || joinName.trim().length < 1 || joinCode.trim().length < 4}
                onClick={(event) => void joinRoom(event)}
              >
                {busy === "join" ? "Joining…" : "Join"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Practice alone</CardTitle>
            <CardDescription>Work one LOTP or Bayes round with optional hints and no congestion from classmates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Same monster math, one player, scored by the server.
            </p>
            <Button className="w-full" variant="secondary" onClick={() => router.push("/practice")}>
              Open practice
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
