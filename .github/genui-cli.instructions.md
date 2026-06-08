---
applyTo: "packages/genui/cli/**"
---

When maintaining `genui a2ui create`, remember that the CLI is shipped inside the `@lynx-js/genui` package and `cli/package.json` remains a nested workspace manifest in the published tarball. Do not use `packages/genui/cli/package.json` for generated-template dependency versions; use the parent `packages/genui/package.json` manifest or another publish-rewritten source so generated apps never keep `workspace:` dependency specifiers.
