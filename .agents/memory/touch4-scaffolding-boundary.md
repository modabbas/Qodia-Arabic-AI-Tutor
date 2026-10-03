---
name: Touch 4 scaffolding boundary
description: Product intent and compatibility decisions for conversational, mastery-based Touch 4 support.
---

Scaffolding belongs inside Touch 4, never a separate warm-up screen. First-move choices are free teaching support, not graded answers, failed submissions, hints, or typing practice.

**Why:** The user reports students closing Touch 4 without attempting its blank editor. They asked for conversational support without changing validation Levels 1/2/3, hint unlocks, XP penalties, or the other touches.

**How to apply:** Submit the full prefix plus student continuation through the existing save/validation flow. Auto-filled characters and first-move choices must not change attempt counts, hints, typing rewards, or first-try eligibility.

Generate first-move content within the existing lesson-generation response only. Older unfinished lessons without that field remain usable with conversational framing and ordinary editing, rather than being regenerated or given fabricated questions.

**Why:** Extra generation violates the requested no-new-AI-call boundary; regenerating unfinished lessons also discards lesson identity and practice evidence.

**How to apply:** Preserve existing drafts over a suggested prefix and keep legacy compatibility explicit. Mastery and completed encounter history are read-only inputs to support levels, not new learning-progress writes.

First-move scaffolding is optional even in newly generated lessons. Missing or malformed questions, ambiguous answers, and unsafe code prefixes must fall back to ordinary direct code input, not reject the entire lesson.

**Why:** Structured Gemini output can satisfy the JSON shape but fail the exact-reference prefix constraints, blocking session generation with HTTP 503. The user explicitly prioritizes usable lessons over optional scaffolding.

**How to apply:** Discard only the invalid first-move block before lesson parsing. Keep valid scaffolds, reference solutions, hints, lesson identity, and every non-scaffold validation rule intact; log a reason without logging private code.