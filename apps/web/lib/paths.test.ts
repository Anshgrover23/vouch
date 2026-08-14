import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseEmail, parseGroupName, parseGroupNotes, parsePassword, emailIssue, passwordIssue } from "./paths";
import { displayNameIssue, parseDisplayName } from "./split";

describe("account name and password", () => {
  it("accepts a display name between 1 and 48 characters", () => {
    assert.equal(parseDisplayName("Ansh"), "Ansh");
    assert.equal(parseDisplayName("  Riley  "), "Riley");
    assert.equal(parseDisplayName(""), null);
    assert.equal(parseDisplayName("x".repeat(49)), null);
  });

  it("requires a password of at least 8 characters", () => {
    assert.equal(parsePassword("password1"), "password1");
    assert.equal(parsePassword("short"), null);
    assert.equal(parsePassword("x".repeat(129)), null);
    assert.equal(passwordIssue(""), "Enter your password.");
    assert.equal(passwordIssue("short"), "Use at least 8 characters.");
    assert.equal(passwordIssue("password1"), null);
  });

  it("says why a display name fails", () => {
    assert.equal(displayNameIssue(""), "Enter your name.");
    assert.equal(displayNameIssue("x".repeat(49)), "Keep it under 48 characters.");
    assert.equal(displayNameIssue("Ansh"), null);
  });
});

describe("group copy", () => {
  it("names a group in 1 to 80 characters and caps notes at 2000", () => {
    assert.equal(parseGroupName("412 Oak"), "412 Oak");
    assert.equal(parseGroupName(""), null);
    assert.equal(parseGroupNotes("Wifi on the fridge."), "Wifi on the fridge.");
    assert.equal(parseGroupNotes("x".repeat(2001)), null);
    assert.equal(parseEmail("ansh@vouch.test"), "ansh@vouch.test");
    assert.equal(emailIssue(""), "Enter your email.");
    assert.equal(emailIssue("ansh"), "That doesn't look like an email.");
    assert.equal(emailIssue("ansh@vouch.test"), null);
  });
});
