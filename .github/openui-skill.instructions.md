---
applyTo: "packages/genui/lynx-openui/**,packages/genui/openui/**"
---

Keep the package-distributed Lynx OpenUI skill in the standalone `@lynx-js/skill-lynx-openui` workspace package at `packages/genui/lynx-openui`. The package directory must match the `lynx-openui` name in `SKILL.md`, as required by the Agent Skills specification. Put `SKILL.md` at the package root and keep optional agent metadata and reference material in `agents/` and `references/`. Do not re-export the skill from `@lynx-js/genui` or `@lynx-js/genui-openui`. Keep the skill's component signatures aligned with `createOpenUiPromptLibrary`, including parameter order, optionality, types, and enums, and keep examples parseable by the current OpenUI v0.5 parser. Add an explicit changeset for SKILL or reference changes because the repository's automatic changed-file patterns only cover `src/**`.
