---
applyTo: "packages/rspeedy/core/src/config/**"
---

When dynamically importing local helper modules from the Rspeedy config loader, tolerate both named ESM exports and default namespace wrappers. GitHub Actions build jobs run with Node.js 22 and loader behavior can expose a helper as `default.validate` even when local Node.js 24 exposes `validate` as a named export.
