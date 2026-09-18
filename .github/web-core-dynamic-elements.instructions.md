---
applyTo: "packages/web-platform/web-core/{package.json,ts/animax.ts}"
---

Keep optional Web custom-element implementations behind explicit side-effect package subpaths and declare their implementation packages as optional peer dependencies, so the default Web Core entry does not resolve or bundle them. Do not couple these opt-in entries to the generic element creation path unless loading on first element creation is explicitly required.
