---
name: Progressive hint contract
description: Keep generation instructions consistent for fresh lessons and older cached lessons.
---

When changing pedagogical constraints on hints, update both fresh-lesson generation and lazy support generation for older lessons, not just the response parser.

**Why:** A healthy provider returned valid JSON with three Arabic hints but an incomplete-solution example had no explicit blank. The consumer correctly rejected it, yet the student saw an apparently generic generation outage. Fresh and cached lessons need the same format instructions.

**How to apply:** State required fields and incomplete-solution markers explicitly in both prompts, and distinguish content-contract failures from provider failures in sanitized diagnostics. Do not fabricate replacement hints or charge XP when generation fails.