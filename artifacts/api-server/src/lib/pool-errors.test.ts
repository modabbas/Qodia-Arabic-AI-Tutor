import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { registerIdlePoolErrorHandler } from "./pool-errors.ts";

test("an idle pool error is handled without crashing or exposing connection details", () => {
  const pool = new EventEmitter();
  const logs: { code: string }[] = [];
  registerIdlePoolErrorHandler(pool, { error(fields) { logs.push(fields); } });
  assert.doesNotThrow(() => pool.emit("error", Object.assign(new Error("private connection details"), { code: "57P01", client: { private: true } })));
  assert.deepEqual(logs, [{ code: "57P01" }]);
  assert.doesNotThrow(() => pool.emit("error", new Error("socket disconnected")));
  assert.deepEqual(logs[1], { code: "unknown" });
  assert.doesNotThrow(() => pool.emit("error", { code: "invalid code with private details" }));
  assert.deepEqual(logs[2], { code: "unknown" });
});