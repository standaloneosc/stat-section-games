"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PublicBettingState } from "@/lib/betting";

export function useBettingState(options: {
  code: string;
  playerId?: string;
  token?: string;
  hostToken?: string;
  enabled?: boolean;
  initialState?: PublicBettingState | null;
}) {
  const { code, playerId, token, hostToken, enabled = true, initialState = null } = options;
  const [state, setState] = useState<PublicBettingState | null>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialState);
  const [connected, setConnected] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (playerId) params.set("playerId", playerId);
    if (token) params.set("token", token);
    if (hostToken) params.set("hostToken", hostToken);
    return params.toString();
  }, [playerId, token, hostToken]);

  const refresh = useCallback(async () => {
    if (!enabled || !code) return;
    try {
      const response = await fetch(`/api/betting/rooms/${code}?${query}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not load this room.");
        setState(null);
        return;
      }
      setState(data);
      setError(null);
    } catch {
      setError("Lost the connection to the game server.");
    } finally {
      setLoading(false);
    }
  }, [code, enabled, query]);

  useEffect(() => {
    if (!enabled || !code) return;
    let closed = false;
    const source = new EventSource(`/api/betting/rooms/${code}/events?${query}`);
    const onPayload = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as PublicBettingState;
        if (!closed && "code" in data) {
          setState(data);
          setError(null);
          setLoading(false);
          setConnected(true);
        }
      } catch {
        // heartbeat
      }
    };
    source.addEventListener("round:state", onPayload);
    source.addEventListener("round:locked", onPayload);
    source.addEventListener("round:resolved", onPayload);
    source.addEventListener("game:leaderboard", onPayload);
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    const poll = window.setInterval(() => {
      void refresh();
    }, 2000);
    return () => {
      closed = true;
      source.close();
      window.clearInterval(poll);
    };
  }, [code, enabled, query, refresh]);

  return { state, error, loading, connected, refresh, setState };
}

export { useCountdown } from "@/hooks/use-room";
