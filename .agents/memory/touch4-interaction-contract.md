---
name: Touch 4 interaction contract
description: Familiarity-based modes, read-only source composition, and unfinished-attempt compatibility.
---

Zero completed encounters selects drag-order with 3–6 real chunks; one selects the free first-move/fill-blank flow regardless of mastery; two or more selects independent writing. Fixed source and student input are separate blocks. All modes feed the same existing Levels 1/2/3 validator; reordering is not a second grading system.

**Why:** The user reports first-encounter abandonment and disorientation when starter code and typing overlap. They explicitly replaced mastery-based scaffolding selection, prohibited new mode-generation calls, and required existing confidence predictions, hint costs, and other touches to remain unchanged.

**How to apply:** Generate mode content in the existing lesson response. Increment familiarity on completed teaching/review sessions, idempotently; do not increment on lesson retrieval, reload, partial checkpoints, or failed saves. Backfill from completed history and pin the input contract for an unfinished lesson.

The server merges a trusted literal prefix with student-only continuation or reconstructs a supplied permutation of server-owned chunks. Historical starter examples/TODOs are not necessarily valid source prefixes. Preserve a saved full-file attempt when it cannot safely be converted to a continuation; never silently prepend a different prefix or discard it to show a puzzle.

**Why:** Older lessons may contain illustrative starter text rather than the beginning of their reference solution, and a redesigned editor must not invalidate existing student work.

**How to apply:** Keep compatibility explicit and preserve lesson identity, project ownership, and draft contents. Puzzle moves reset inactivity but never earn character-typing XP. Keep code diagnostics aware of the read-only context while displaying only the student's editable lines.

Exercise formatting mismatches should be repaired locally from the canonical reference, not by requesting another lesson. A valid programming task need not have three separate source lines.

**Why:** Live generation reached parsed lesson data but failed the ordering-format contract. Retrying generation did not resolve that blocker; whitespace and chunk boundaries are not themselves evidence that the programming task is invalid.

**How to apply:** Preserve source semantics when grouping chunks, including single-line expressions. Never insert line breaks merely to satisfy the visual puzzle format, and never reinterpret an unfinished lesson's already-pinned contract.

Correct an untouched cached first encounter's wrong mode only when the canonical source is available and its fixed prefix can remain identical. Preserve a started attempt's input contract.

**Why:** A lesson can retain an incorrect cached mode despite a zero encounter count. However, absence of a server draft does not prove absence of work: an unsent browser continuation may still depend on the original prefix.

**How to apply:** Distinguish safe mode repair from changing existing source or discarding input. Preserve browser-only continuations as full source when switching their editor compatibility mode; never regenerate a lesson to repair this metadata.