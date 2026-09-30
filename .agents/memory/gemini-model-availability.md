---
name: Gemini model availability
description: An observed mismatch between Gemini model listing and actual structured generation in this workspace.
---

For this project's configured Gemini key, a model listing succeeded and included a Flash model that nevertheless returned model-not-found for structured lesson generation. An older Flash model also returned model-not-found. A different Flash preview model passed a direct structured-output probe and produced a complete lesson through the authenticated app. A subsequent request to that model failed with a provider server error, so fallback remains necessary.

**Why:** A successful model listing, or a known model name from documentation, did not prove this key could generate the required structured response. The app initially served only fallbacks until an actual generation probe identified a working model.

**How to apply:** When changing Gemini models or diagnosing unexpected fallback, check a real structured generation with the configured key while keeping the key server-only. Treat provider errors as recoverable and preserve the project-aware fallback.