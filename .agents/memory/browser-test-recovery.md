---
name: Browser test recovery
description: Recovering disposable development QA sessions after a browser worker reset
---

A testing worker reset can lose its notebook, browser pages, cookies, and in-memory random password while the application has successfully persisted the account and lesson.

**Why:** A worker reset during a generation wait left a successfully cached lesson inaccessible to the tester, despite the application itself continuing normally.

**How to apply:** Plan an ephemeral recovery method for disposable QA logins before long waits. If recovery requires a credential reset, limit it to the known disposable development account with an exact identity guard and explicit authorization; never reset a real student's account for testing. Reuse persisted lessons instead of generating replacements. Never save passwords, hashes, or cookies in project memory.

Keep individual browser-tool executions below 45 seconds; split longer inactivity scenarios into short waits with intermediate assertions.

**Why:** A compound timing check exceeded the notebook's 45-second execution limit and reset the worker before it could return evidence.

**How to apply:** Do not combine multiple long waits into one browser call. Use recoverable disposable fixtures and distinguish a runner timeout from an observed application failure.

For activity timing checks, wait for the asynchronous action's response and rendered ready state before entering the first timed edit. Measure actual input intervals and compensate waits for time spent between tool calls.

**Why:** Awaiting a click did not await hint reveal completion, so an early keypress correctly produced no hint activity request. Inter-call overhead also turned a planned 20-second input interval into more than 35 seconds, unlocking the next hint before the second edit. Both checks passed after these test-ordering issues were corrected.

**How to apply:** Capture response and trusted input timestamps. Assert the intended starting state before typing; do not infer application failure from a DOM value change alone or from planned sleep durations.