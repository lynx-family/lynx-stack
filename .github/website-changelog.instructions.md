---
applyTo: "packages/web-platform/**/package.json"
---

If a web-platform package is referenced by website changelog generation, export `./package.json` from the package `exports` map so `website/sidebars/changelog.ts` can resolve the package root under Node ESM export rules.
