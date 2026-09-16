export const HOST_COOKIE_MAX_AGE = 60 * 60 * 8;

export function hostCookieName(code: string): string {
  return `hsg_host_${code.toUpperCase()}`;
}

export function hostCookieHeader(code: string, token: string): string {
  return `${hostCookieName(code)}=${encodeURIComponent(token)}; Path=/; Max-Age=${HOST_COOKIE_MAX_AGE}; SameSite=Lax; HttpOnly`;
}

export function readHostTokenFromCookie(cookieHeader: string | null | undefined, code: string): string | null {
  if (!cookieHeader) {
    return null;
  }
  const target = hostCookieName(code);
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
