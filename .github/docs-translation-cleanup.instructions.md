---
applyTo: "docs/plugins/translate.ts,.github/workflows/test.yml,docs/turbo.json"
---

Translation cleanup must be opt-in after a complete workspace build. Preserve translations during dev and partial generation. Use LYNX_DOCS_PRUNE_TRANSLATIONS=1 for cleanup, declare it in the docs Turbo task environment, and keep the CI dictionary consistency check. Layered dictionaries may rewrite only the local output dictionary, never the inherited base files.
