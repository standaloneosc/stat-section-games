export const HOST_COOKIE_MAX_AGE = 60 * 60 * 8;

export function hostCookieName(code: string): string {
  return `hsg_host_${code.toUpperCase()}`;
}

export function coinRaceHostCookieName(code: string): string {
  return `cpr_host_${code.toUpperCase()}`;
}

export function bettingHostCookieName(code: string): string {
  return `qbg_host_${code.toUpperCase()}`;
}

function cookieHeader(name: string, token: string): string {
  return `${name}=${encodeURIComponent(token)}; Path=/; Max-Age=${HOST_COOKIE_MAX_AGE}; SameSite=Lax; HttpOnly`;
}

export function hostCookieHeader(code: string, token: string): string {
  return cookieHeader(hostCookieName(code), token);
}

export function coinRaceHostCookieHeader(code: string, token: string): string {
  return cookieHeader(coinRaceHostCookieName(code), token);
}

export function bettingHostCookieHeader(code: string, token: string): string {
  return cookieHeader(bettingHostCookieName(code), token);
}

function readNamedCookie(cookieHeader: string | null | undefined, target: string): string | null {
  if (!cookieHeader) {
    return null;
  }
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === target) {
      const value = rest.join("=");
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return null;
}

export function readHostTokenFromCookie(cookieHeader: string | null | undefined, code: string): string | null {
  return readNamedCookie(cookieHeader, hostCookieName(code));
}

export function readCoinRaceHostTokenFromCookie(
  cookieHeader: string | null | undefined,
  code: string
): string | null {
  return readNamedCookie(cookieHeader, coinRaceHostCookieName(code));
}

export function readBettingHostTokenFromCookie(
  cookieHeader: string | null | undefined,
  code: string
): string | null {
  return readNamedCookie(cookieHeader, bettingHostCookieName(code));
}
