import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeSession, encodeSession } from "./session-cookie";
import { afterAuthPath, safeNextPath } from "./paths";

describe("session cookie", () => {
  it("round-trips a signed session", async () => {
    const session = {
      userId: "u1",
      workspaceId: "w1",
      email: "rio@vouch.dev",
      displayName: "Rio",
      onboarded: false,
    };
    const token = await encodeSession(session);
    assert.deepEqual(await decodeSession(token), session);
  });

  it("rejects a tampered signature", async () => {
    const token = await encodeSession({
      userId: "u1",
      workspaceId: "w1",
      email: "rio@vouch.dev",
      displayName: "Rio",
      onboarded: true,
    });
    const [payload] = token.split(".");
    assert.equal(await decodeSession(`${payload}.deadbeef`), null);
  });

  it("rejects a cookie signed with a different SESSION_SECRET", async () => {
    const prev = process.env.SESSION_SECRET;
    try {
      process.env.SESSION_SECRET = "secret-from-root-env";
      const token = await encodeSession({
        userId: "u1",
        workspaceId: "w1",
        email: "rio@vouch.dev",
        displayName: "Rio",
        onboarded: true,
      });
      process.env.SESSION_SECRET = "dev-only-change-me";
      assert.equal(await decodeSession(token), null);
    } finally {
      if (prev === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = prev;
    }
  });

  it("treats the demo user as already onboarded", async () => {
    const token = await encodeSession({
      userId: "11111111-1111-1111-1111-111111111111",
      workspaceId: "22222222-2222-2222-2222-222222222222",
      email: "demo@proofsheet.dev",
      displayName: "Demo reviewer",
      onboarded: false,
    });
    const session = await decodeSession(token);
    assert.equal(session?.onboarded, true);
  });
});

describe("safeNextPath", () => {
  it("blocks protocol-relative and external URLs", () => {
    assert.equal(safeNextPath("//evil.test"), "/inbox");
    assert.equal(safeNextPath("https://evil.test"), "/inbox");
    assert.equal(safeNextPath("/s/abc"), "/s/abc");
  });
});

describe("afterAuthPath", () => {
  it("sends new users to onboarding unless they came from a share link", () => {
    assert.equal(afterAuthPath(false, "/inbox"), "/onboarding");
    assert.equal(afterAuthPath(false, "/s/abc"), "/s/abc");
    assert.equal(afterAuthPath(true, "/review/1"), "/review/1");
  });
});
