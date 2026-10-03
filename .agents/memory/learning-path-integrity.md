---
name: Learning-path integrity
description: Why lesson identity, prerequisite reinforcement, and saved project work are separate concerns.
---

The no-repeat rule applies to newly taught concepts, not explicitly labelled reviews. All five saved touches complete a concept regardless of its mastery score and unlock its dependent planned concepts. Keep mastery separate for explicitly labelled spaced reviews; do not force an immediate repeat solely because completion scored below 70%.

**Why:** The user explicitly requires a fully completed session to advance to the next concept in the 30-concept plan. Mastery-gated completion had sent fully finished low-scoring students straight back to the same concept.

**How to apply:** Gate prerequisites on completed learning, not a mastery threshold. Preserve actual scores and spaced-review timing. Repair historical completion from saved evidence without granting extra encounters or XP. Skip an obsolete unstarted early-review cache when new learning is available, but preserve started review work.

An unfinished lesson remains the same attempt across midnight, cache expiry, reloads, and refocus. Completion, not the calendar date, allows advancement.

**Why:** Daily caching is an optimization, not a learning boundary. Regenerating an unfinished attempt can discard practice evidence and create duplicate rewards.

**How to apply:** Keep owner-scoped lesson identity separate from daily history grouping and keep the displayed lesson stable during interaction.

Dashboard freshness and an active session's stability are different requirements. Refresh the dashboard's challenge on each visit, and do not offer the cached lesson as the current challenge while that refresh is pending or failed.

**Why:** A structurally valid cached lesson may already be completed. Showing it during a background refresh can let a student restart the old attempt before the next lesson arrives.

**How to apply:** Keep the current lesson stable inside an active session, but wait for a successful fresh lookup before enabling the dashboard's start action. Leave concept selection and completion rules unchanged.

Review mastery and original project-file ownership are independent. Reviews can update mastery without changing the original saved code or its completion attribution.

**Why:** Reusing the source file's original lesson as the authority for mastery undoes successful reviews; replacing its ownership misrepresents when the student actually built the file.

**How to apply:** Reconcile learning evidence independently from immutable completed-file evidence, and store review practice separately.