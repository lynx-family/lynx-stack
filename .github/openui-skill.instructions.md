---
applyTo: "packages/genui/openui/**,packages/genui/package.json"
---

Keep the package-distributed Lynx OpenUI skill at `packages/genui/openui/skills/lynx-openui/SKILL.md`. Expose it as `./skill` from the private OpenUI workspace package and as `./openui/skill` from the published `@lynx-js/genui` package, and include `openui/skills` in the published package `files`; a private workspace export alone is not distributable. Keep the skill's component signatures aligned with `createOpenUiPromptLibrary`, keep examples parseable by the current OpenUI v0.5 parser, and run the package skill validator after changing the prompt catalog, runtime semantics, skill, examples, or package exports.
