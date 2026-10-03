---
name: Touch 4 confidence boundary
description: Product intent and persistence decision for the ungraded pre-result prediction.
---

Touch 4's confidence prediction is a psychological/engagement layer, not an assessment. Its accuracy must never add XP, penalties, or grading influence, and it must not be confused with Touch 5's defense confidence.

**Why:** The user explicitly requested only a brief insertion in the result-reveal sequence, preserving validation, hints, scaffolding, and the side-panel layout, with local reaction text and no extra Gemini call.

**How to apply:** Keep reactions supplementary to the complete existing result. A skip or timeout is unknown confidence, not a default medium prediction. Transport errors are not evidence that the student's code is wrong.

Persistence was deliberately deferred rather than adding submission/session fields.

**Why:** The user made storage optional and low priority, allowing an ephemeral interaction when persistence would require non-trivial schema/API changes.

**How to apply:** Do not treat absent confidence history as a broken feature; add storage only for a separately requested use case.