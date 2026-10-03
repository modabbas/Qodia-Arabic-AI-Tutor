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

## Formatting tolerance and diagnostic feedback

The user permits formatting tolerance, compact rejection diffs, and 500ms local syntax cues on top of the existing three levels. Do not rebuild the validator or change Gemini Level 3 prompts, learning-path behavior, hints/XP rules, or cumulative-project logic.

**Why:** Harmless formatting rejections discourage students, but whitespace inside strings and Python/YAML nesting can change what their code means.

**How to apply:** Native parsers retain meaningful source whitespace; canonical whitespace is only a comparison view. Preserve raw submitted/saved code and actual indentation errors. YAML indentation widths may vary while nesting remains equivalent; Python consistent tabs/spaces remain subject to its parser. Diff feedback is diagnostic, never an exact-reference acceptance gate, and must not reveal gated solution lines. Live cues stay local, debounced, and non-blocking.

Syntax feedback must show one diagnostic at the source problem, not reference-diff annotations for subsequent lines.

**Why:** A single missing parenthesis can disrupt reference alignment and generate many identical “missing” boxes, misleading the student about how many errors exist.

**How to apply:** Use the unmatched opening bracket or native parser location, include the character position when available, and show nearby lines as neutral context. Keep reference comparison for structural feedback and do not change acceptance rules.