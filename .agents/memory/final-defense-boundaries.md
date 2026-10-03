---
name: Final-defense boundaries
description: Product scope and fairness decisions for the final-defense practice simulator.
---

The final defense is a separate practice assessment. It uses saved project code and completed concepts without changing the Learning Path, Cumulative Project, Validation, Hints, XP, or mastery as a side effect. Weak concepts are recommendations, not automatic mastery changes.

**Why:** The user's brief explicitly required using the existing engines rather than rebuilding or modifying them.

**How to apply:** Keep future defense features additive. Do not apply the daily-session assessment-outage fallback to defense scoring: an unavailable evaluator leaves the original answer locked and the score unknown until evaluation succeeds.

Use 60 seconds per question, not the illustrative JSON's 45 seconds. Keep server deadlines authoritative across reloads. A fixed two-second transport tolerance is permitted, not an extension that the student can reset.

**Why:** The entry and timer requirements specify 60 seconds and no penalty for using all the available time. A bounded delivery tolerance prevents ordinary network transit from discarding the final keystrokes.

**How to apply:** Beyond the tolerance, use only the server-saved draft. A provider retry must evaluate the exact original locked answer; it must never reopen editing or fabricate a score.

Gemini may put both linked concepts into question four's metadata even when asked for one. Normalize only known completed-concept names; do not weaken saved-file grounding or accept invented concepts to avoid the curated fallback.

**Why:** A live generation was otherwise valid but rejected solely because its question-four metadata combined two known studied names.

**How to apply:** Accept unambiguous Arabic or English studied aliases, independently check both concepts in the actual question, and keep committee identities and ordered difficulty server-owned.

Temporary eligibility reductions must also remain compatible with the deterministic question bank, not just the eligibility check.

**Why:** A judge-demo threshold of one concept would unlock the UI, but linked-concept questions need two studied concepts in the existing fallback. A provider outage could then make an apparently eligible discussion impossible to start.

**How to apply:** Use at least two completed concepts for a reduced demo threshold without changing generation, saved-file requirements, or grading.