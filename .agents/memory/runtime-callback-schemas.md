---
name: Runtime callback schemas
description: Handling skill examples that no longer match registered callback validation
---

Prefer the registered callback's validation schema when a skill example conflicts with it.

**Why:** The follow-up skill documented the category `test_coverage`, but the callback rejected it and accepted `test_gaps`.

**How to apply:** For testing follow-up suggestions use `test_gaps` while that runtime enum remains valid. If validation changes again, follow the returned allowed values rather than repeatedly submitting the stale example.