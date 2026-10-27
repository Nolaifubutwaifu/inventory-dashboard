import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isOpenPath,
  passwordsMatch,
  safeNextPath,
  sessionMatches,
  signSession,
} from "./dashboard-auth";

describe("dashboard password gate", () => {
  it("leaves the upload routes open and keeps the pages closed", () => {
    assert.equal(isOpenPath("/api/history/update"), true);
    assert.equal(isOpenPath("/api/sales/update"), true);
    assert.equal(isOpenPath("/api/inventory/update"), true);
    assert.equal(isOpenPath("/api/auth/login"), true);
    assert.equal(isOpenPath("/login"), true);
    assert.equal(isOpenPath("/"), false);
    assert.equal(isOpenPath("/api/sales"), false);
    assert.equal(isOpenPath("/api/inventory"), false);
    assert.equal(isOpenPath("/api/history"), false);
  });

  it("signs a cookie that only matches the same password", async () => {
    const token = await signSession("correct horse");
    assert.equal(await sessionMatches(token, "correct horse"), true);
    assert.equal(await sessionMatches(token, "wrong horse"), false);
    assert.equal(await sessionMatches(undefined, "correct horse"), false);
    assert.equal(passwordsMatch("correct horse", "correct horse"), true);
    assert.equal(passwordsMatch("correct horse", "correct horsE"), false);
  });

  it("only accepts a same-site path after login", () => {
    assert.equal(safeNextPath("/"), "/");
    assert.equal(safeNextPath("/login"), "/");
    assert.equal(safeNextPath("//evil.example"), "/");
    assert.equal(safeNextPath("https://evil.example"), "/");
    assert.equal(safeNextPath("/sales"), "/sales");
  });
});
