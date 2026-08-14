import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authRedirect } from "./auth-guard";

const onboarded = { onboarded: true };
const pending = { onboarded: false };

describe("authRedirect", () => {
  it("sends anonymous visitors on /inbox and /new to login, not a 307 loop", () => {
    assert.deepEqual(authRedirect("/inbox", "", null), {
      pathname: "/login",
      search: "?next=%2Finbox",
    });
    assert.deepEqual(authRedirect("/groups", "", null), {
      pathname: "/login",
      search: "?next=%2Fgroups",
    });
    assert.deepEqual(authRedirect("/account", "", null), {
      pathname: "/login",
      search: "?next=%2Faccount",
    });
    assert.deepEqual(authRedirect("/new", "", null), {
      pathname: "/login",
      search: "?next=%2Fnew",
    });
    assert.deepEqual(authRedirect("/review/abc", "?_rsc=1", null), {
      pathname: "/login",
      search: "?next=%2Freview%2Fabc%3F_rsc%3D1",
    });
  });

  it("lets a valid onboarded session through /inbox, /new, and /review", () => {
    assert.equal(authRedirect("/inbox", "?_rsc=1", onboarded), null);
    assert.equal(authRedirect("/groups", "", onboarded), null);
    assert.equal(authRedirect("/groups/abc", "", onboarded), null);
    assert.equal(authRedirect("/account", "", onboarded), null);
    assert.equal(authRedirect("/new", "", onboarded), null);
    assert.equal(authRedirect("/review/abc", "", onboarded), null);
  });

  it("sends a signed-in but not onboarded user to /onboarding instead of /login", () => {
    assert.deepEqual(authRedirect("/inbox", "", pending), { pathname: "/onboarding", search: "" });
    assert.deepEqual(authRedirect("/login", "?next=%2Finbox", pending), {
      pathname: "/onboarding",
      search: "",
    });
    assert.equal(authRedirect("/onboarding", "", pending), null);
  });

  it("sends an already-onboarded user away from login/signup to next or /inbox", () => {
    assert.deepEqual(authRedirect("/login", "?next=%2Finbox", onboarded), {
      pathname: "/inbox",
      search: "",
    });
    assert.deepEqual(authRedirect("/login", "?next=%2Freview%2Fabc", onboarded), {
      pathname: "/review/abc",
      search: "",
    });
    assert.deepEqual(authRedirect("/signup", "", onboarded), { pathname: "/inbox", search: "" });
    assert.deepEqual(authRedirect("/onboarding", "", onboarded), { pathname: "/inbox", search: "" });
  });

  it("does not treat a public page as authed or logged out", () => {
    assert.equal(authRedirect("/", "", null), null);
    assert.equal(authRedirect("/login", "", null), null);
  });
});
