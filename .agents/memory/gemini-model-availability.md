---
name: Gemini model availability
description: An observed mismatch between Gemini model listing and actual structured generation in this workspace.
---

For this project's configured Gemini key, listing models has repeatedly included Flash models that returned model-not-found on actual structured generation. A model that worked previously also exhausted its model-specific free quota, while a different listed model passed structured generation with the same key.

**Why:** Listing, generation capability, and quota availability are separate checks. Neither documentation nor a successful listing proves a particular key can generate the required structured response.

**How to apply:** Verify a small structured generation using the existing server-only key before choosing a replacement model. If curriculum generation fails, label any standardized map honestly. If a selected-concept lesson fails, return a retryable error rather than rename generic content as that concept.

Complex curriculum schemas with outer-array `minItems`/`maxItems` set to 30 can return provider `INVALID_ARGUMENT` even when the same full schema without those bounds generates successfully.

**Why:** Live structured-generation comparisons isolated those bounds as the rejection cause; a small boolean schema did not reveal it.

**How to apply:** Enforce exactly 30 entries in the application validator, not those provider-side array bounds. Keep all identity, prerequisite, day, and approved-path validation intact.

A working Gemini key and successful generation do not prove that a session will load: local concept-evidence validation can reject a valid Arabic lesson after the provider responds.

**Why:** A Flutter dependency-management lesson was repeatedly rejected by English-only exact-term matching, even though its map and prerequisite selection were valid. Arabic descriptions and `dependencies` are not literal matches for `dependency`.

**How to apply:** Distinguish provider errors from local validation failures using named-stage logs. Preserve pinned concept identity and evidence checks, but account for translated terminology and grammatical variants; do not resolve validation failures with renamed generic lessons.