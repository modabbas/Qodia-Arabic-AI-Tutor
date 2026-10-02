---
name: Progressive hint contract
description: Keep generation instructions consistent for fresh lessons and older cached lessons.
---

When changing pedagogical constraints on hints, update both fresh-lesson generation and lazy support generation for older lessons, not just the response parser.

**Why:** A healthy provider can return valid JSON that violates the teaching contract. Fresh and cached lessons need the same instructions so content-contract failures are not mistaken for generic provider outages.

**How to apply:** State the current required and forbidden fields explicitly in both prompts, and distinguish content-contract failures from provider failures in sanitized diagnostics. Do not fabricate replacement hints or charge XP when generation fails.

## Strict unlocks and a teaching-only third hint

Unlock levels in order after failed submissions, with a new failure between unlocks. Previously unlocked hints remain freely reviewable. Keep the current XP deduction visible directly above the controls. Hint 3 explains the required function and asks a guiding question; it must not contain code, partial answer syntax, or fill-in-the-blank templates. Do not change hints 1/2 or student-code validation for this behavior.

**Why:** The user reported out-of-order hint access and a third hint that gave away near-complete answers rather than teaching.

**How to apply:** Keep the legacy `partial_solution` identifier for compatibility, but enforce text-only functional guidance for delivery. Older lesson metadata must remain loadable; upgrade an outdated third hint on demand without changing already-opened hints 1/2, the reference solution, unlock checkpoints, or XP charges.