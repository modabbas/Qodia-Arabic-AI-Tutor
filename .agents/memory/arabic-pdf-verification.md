---
name: Arabic PDF verification
description: Why generated Arabic reports require visual verification of mixed-direction text.
---

Render a generated PDF and inspect its text order before declaring Arabic export working. A valid PDF header, embedded font, and successful text extraction are insufficient.

**Why:** Arabic shaping and bidirectional processing can reverse already-reordered text. Reports can appear correct in extraction while displaying backwards Arabic, reversed years, or reversed Latin file paths.

**How to apply:** Check an Arabic heading, an Arabic paragraph containing a Latin technical term or file path, and a date or number. Check pagination as well as font availability. Treat PDF text as logical Unicode input and avoid applying direction reversal twice.