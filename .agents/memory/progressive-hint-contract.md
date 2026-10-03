---
name: Progressive hint contract
description: Keep generation instructions consistent for fresh lessons and older cached lessons.
---

When changing pedagogical constraints on hints, update both fresh-lesson generation and lazy support generation for older lessons, not just the response parser.

**Why:** A healthy provider can return valid JSON that violates the teaching contract. Fresh and cached lessons need the same instructions so content-contract failures are not mistaken for generic provider outages.

**How to apply:** State the current required and forbidden fields explicitly in both prompts, and distinguish content-contract failures from provider failures in sanitized diagnostics. Do not fabricate replacement hints or charge XP when generation fails.

## Strict unlocks and a teaching-only third hint

Hint 1 is available immediately. Later tiers unlock in order after either 35 seconds of inactivity since opening the preceding tier or a new failed submission. Previously unlocked hints remain freely reviewable; each newly opened hint still costs 10 XP. Hint 1 must include concrete generic syntax, not the task answer. Hint 3 explains the required function and asks a guiding question; it must not contain code, partial answer syntax, or fill-in-the-blank templates.

**Why:** The user reported out-of-order hint access and a third hint that gave away near-complete answers rather than teaching.

**How to apply:** Keep the legacy `partial_solution` identifier for compatibility, but enforce text-only functional guidance for delivery. Update both fresh and lazy hint prompts. Older hint 1 can reuse the lesson's existing different-task syntax example without another model call or charge. Preserve hint 2/3 content, reference solutions, unlock checkpoints, and existing payments during that upgrade.