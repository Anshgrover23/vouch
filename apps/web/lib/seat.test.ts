import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { seatInviteMessage, seatLoginPath, seatSharePath, seatSignupPath, withSeatQuery } from "./seat";

describe("seat paths", () => {
  it("keeps the view-only bill link free of an invite token", () => {
    assert.equal(seatSharePath("bill-1"), "/s/bill-1");
  });

  it("puts Goru's invite on the bill link so opening it is that seat", () => {
    assert.equal(seatSharePath("bill-1", "goru-token"), "/s/bill-1?as=goru-token");
  });

  it("appends as= onto an origin share URL", () => {
    assert.equal(withSeatQuery("https://vouch.test/s/bill-1", "goru-token"), "https://vouch.test/s/bill-1?as=goru-token");
    assert.equal(withSeatQuery("https://vouch.test/s/bill-1"), "https://vouch.test/s/bill-1");
  });

  it("names the seat in the WhatsApp line", () => {
    assert.equal(
      seatInviteMessage("https://vouch.test/s/bill-1?as=goru-token", "Goru"),
      "You're on this split as Goru: https://vouch.test/s/bill-1?as=goru-token",
    );
  });

  it("sends signup and login back to that seat", () => {
    assert.equal(
      seatSignupPath("bill-1", "goru-token"),
      "/signup?invite=goru-token&next=%2Fs%2Fbill-1%3Fas%3Dgoru-token",
    );
    assert.equal(
      seatLoginPath("bill-1", "goru-token"),
      "/login?invite=goru-token&next=%2Fs%2Fbill-1%3Fas%3Dgoru-token",
    );
  });
});
