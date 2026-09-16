import { describe, expect, it } from "vitest";
import { hostCookieHeader, hostCookieName, readHostTokenFromCookie } from "./host-cookie";

describe("host cookie", () => {
  it("round-trips a token for a room code", () => {
    const header = hostCookieHeader("ab3k", "token-1");
    expect(hostCookieName("ab3k")).toBe("hsg_host_AB3K");
    expect(header).toContain("HttpOnly");
    expect(readHostTokenFromCookie(`other=1; ${header.split(";")[0]}`, "AB3K")).toBe("token-1");
  });
});
