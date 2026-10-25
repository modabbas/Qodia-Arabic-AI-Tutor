import assert from "node:assert/strict";
import test from "node:test";
import { cleanStoreText, normalizeStoreContact, StoreSubmissionLimiter, validStoreAdminKey } from "./store-rules.ts";

test("store contacts deduplicate casing, whitespace, phone formatting and Arabic digits", () => {
  assert.equal(normalizeStoreContact(" Student@Example.COM ").normalized, "email:student@example.com");
  assert.equal(normalizeStoreContact("+963 (944) 123-456").normalized, normalizeStoreContact("00963944123456").normalized);
  assert.equal(normalizeStoreContact("+٩٦٣٩٤٤١٢٣٤٥٦").normalized, "phone:963944123456");
  for (const contact of ["not-an-email", "x@", "a@b", "123", "<script>", "abc1234567", "1".repeat(16)]) {
    assert.throws(() => normalizeStoreContact(contact));
  }
});

test("store text rejects HTML, controls and oversized fields while preserving Arabic prose", () => {
  assert.equal(cleanStoreText("  أريد شرح المشروع  ", 100), "أريد شرح المشروع");
  for (const text of ["<img src=x onerror=alert(1)>", "\u0000text", "x".repeat(101)]) {
    assert.throws(() => cleanStoreText(text, 100));
  }
});

test("store admin authorization fails closed without a configured strong matching key", () => {
  const key = "disposable-test-admin-value";
  assert.equal(validStoreAdminKey(key, key), true);
  for (const candidate of ["wrong", undefined, [], { key }]) assert.equal(validStoreAdminKey(candidate, key), false);
  assert.equal(validStoreAdminKey(key, undefined), false);
  assert.equal(validStoreAdminKey("short", "short"), false);
});

test("store submission limiter is bounded and expires", () => {
  const limiter = new StoreSubmissionLimiter();
  for (let index = 0; index < 10; index++) assert.equal(limiter.allow("client", 0), true);
  assert.equal(limiter.allow("client", 1), false);
  assert.equal(limiter.allow("client", 600001), true);
});
