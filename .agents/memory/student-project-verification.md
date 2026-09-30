---
name: Student project verification
description: Security and accuracy constraints for verifying downloadable student projects
---

Student-submitted source is untrusted. Verify it by parsing and, where practical, bundling local imports in memory; do not install packages, run package scripts, load user config, or execute project code on Qodia's API server. A passing syntax/local-import check must not be described as a successful framework build.

**Why:** Build tools can execute project-defined scripts, plugins, or configuration. Without a separate sandbox, running the full toolchain on the shared API server risks executing untrusted student code and producing misleading success claims.

**How to apply:** For a future full-build feature, use an isolated, resource-limited execution environment and report full-build status only after the actual stack build passes. Keep partial checks clearly scoped in API and UI language.