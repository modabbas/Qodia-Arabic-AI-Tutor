---
name: Touch 4 validation policy
description: The deliberate fail-soft policy for code assessment, distinct from lesson generation.
---

For Touch 4 code assessment, the user explicitly requested: “if Gemini Level 3 fails, accept based on Level 1-2 only (don't block student).” This exception is for assessing an existing lesson, not for generating a substitute lesson.

**Why:** The user prioritizes keeping students moving during assessment-provider failures. This deliberately gives less assurance than semantic assessment; it must not be described as proof that the code runs or satisfies the task.

**How to apply:** Syntax and structural checks remain mandatory. Label provider-unavailable acceptance explicitly, without inventing a semantic score. A completed negative semantic assessment is a failed solution, not an outage fallback. Do not reuse this exception to return generic content renamed as a selected curriculum concept.

## Assistance must not change validation

The user confirmed: “That system WORKS CORRECTLY and should NOT be modified.” Progressive hints must be added “ON TOP of the existing validation” and appear after validation fails.

**Why:** The user explicitly confirmed the three-level implementation and required it to remain intact while adding learning support.

**How to apply:** Keep hint unlocking, reference-answer access, and their XP adjustments separate from the existing checks and acceptance rules. Assistance does not bypass code validation.