---
name: Artifact build context
description: Why standalone shell builds can lack settings available to a managed artifact workflow.
---

One-off shell builds do not automatically inherit the serving settings injected into an artifact's managed workflow.

**Why:** A running app can build successfully in its workflow while the same build command in a plain shell fails for missing runtime configuration. This is not evidence that the app configuration is broken.

**How to apply:** Check which serving settings the build requires and supply appropriate build-only values on the command. Do not weaken the configuration checks, create duplicate workflows, or persist environment changes just to run a one-off build.