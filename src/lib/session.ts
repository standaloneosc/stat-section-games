const HOST_PREFIX = "hide-seek:host:";
const PLAYER_PREFIX = "hide-seek:player:";
const COIN_HOST_PREFIX = "coin-race:host:";
const COIN_PLAYER_PREFIX = "coin-race:player:";

export type PlayerSession = {
  playerId: string;
  token: string;
  name: string;
};

export function saveHostSession(code: string, hostToken: string) {
  localStorage.setItem(HOST_PREFIX + code.toUpperCase(), hostToken);
}

export function loadHostSession(code: string): string | null {
  return localStorage.getItem(HOST_PREFIX + code.toUpperCase());
}

export function savePlayerSession(code: string, session: PlayerSession) {
  localStorage.setItem(PLAYER_PREFIX + code.toUpperCase(), JSON.stringify(session));
}

export function loadPlayerSession(code: string): PlayerSession | null {
  const raw = localStorage.getItem(PLAYER_PREFIX + code.toUpperCase());
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as PlayerSession;
  } catch {
    return null;
  }
}

export function clearPlayerSession(code: string) {
  localStorage.removeItem(PLAYER_PREFIX + code.toUpperCase());
}

export function saveCoinRaceHostSession(code: string, hostToken: string) {
  localStorage.setItem(COIN_HOST_PREFIX + code.toUpperCase(), hostToken);
}

export function loadCoinRaceHostSession(code: string): string | null {
  return localStorage.getItem(COIN_HOST_PREFIX + code.toUpperCase());
}

export function saveCoinRacePlayerSession(code: string, session: PlayerSession) {
  localStorage.setItem(COIN_PLAYER_PREFIX + code.toUpperCase(), JSON.stringify(session));
}

export function loadCoinRacePlayerSession(code: string): PlayerSession | null {
  const raw = localStorage.getItem(COIN_PLAYER_PREFIX + code.toUpperCase());
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as PlayerSession;
  } catch {
    return null;
  }
}
