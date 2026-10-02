---
name: Learning-path integrity
description: Why lesson identity, prerequisite reinforcement, and saved project work are separate concerns.
---

The no-repeat rule applies to newly taught concepts, not explicitly labelled reviews. If every remaining new concept is blocked by low mastery before its normal review date, offer clearly labelled early reinforcement rather than teach a locked concept.

**Why:** A strict no-repeat interpretation combined with mastery-gated prerequisites can leave a struggling student unable to continue. The brief's suggested “any planned concept” fallback defeats prerequisite safety.

**How to apply:** Preserve prerequisite gates and distinguish ordinary due reviews from early reinforcement in both selection and user-visible explanations.

An unfinished lesson remains the same attempt across midnight, cache expiry, reloads, and refocus. Completion, not the calendar date, allows advancement.

**Why:** Daily caching is an optimization, not a learning boundary. Regenerating an unfinished attempt can discard practice evidence and create duplicate rewards.

**How to apply:** Keep owner-scoped lesson identity separate from daily history grouping and keep the displayed lesson stable during interaction.

Dashboard freshness and an active session's stability are different requirements. Refresh the dashboard's challenge on each visit, and do not offer the cached lesson as the current challenge while that refresh is pending or failed.

**Why:** A structurally valid cached lesson may already be completed. Showing it during a background refresh can let a student restart the old attempt before the next lesson arrives.

**How to apply:** Keep the current lesson stable inside an active session, but wait for a successful fresh lookup before enabling the dashboard's start action. Leave concept selection and completion rules unchanged.

Review mastery and original project-file ownership are independent. Reviews can update mastery without changing the original saved code or its completion attribution.

**Why:** Reusing the source file's original lesson as the authority for mastery undoes successful reviews; replacing its ownership misrepresents when the student actually built the file.

**How to apply:** Reconcile learning evidence independently from immutable completed-file evidence, and store review practice separately.