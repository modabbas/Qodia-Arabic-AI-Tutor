import assert from "node:assert/strict";
import test from "node:test";
import { codePreview, snippetDay } from "./pride-moment.ts";

test("saved code previews preserve indentation, count full source and truncate only the preview", () => {
  assert.deepEqual(codePreview("  a\r\n  b\r\nc\nd\ne\n"), {
    preview: "  a\n  b\nc\nd\n...", line_count: 5,
  });
  assert.deepEqual(codePreview("one"), { preview: "one", line_count: 1 });
  assert.deepEqual(codePreview(" \n"), { preview: "", line_count: 0 });
  assert.equal(codePreview("x".repeat(1000)).preview.length, 183);
});
test("day labels use Damascus calendar dates, including a midnight crossing under 24 hours", () => {
  assert.equal(snippetDay(new Date("2026-10-02T20:00:00Z"), new Date("2026-10-02T22:00:00Z")), 2);
  assert.equal(snippetDay(new Date("2026-10-02T10:00:00Z"), new Date("2026-10-09T10:00:00Z")), 8);
});