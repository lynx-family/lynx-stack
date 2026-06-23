---
applyTo: "packages/genui/a2ui/**"
---

When maintaining the package-distributed Codex skill for `packages/genui/a2ui`, keep it at `skills/lynx-a2ui/SKILL.md` and expose it through the package `exports` map as `"./skill": "./skills/lynx-a2ui/SKILL.md"`. Keep the skill directory name aligned with the `SKILL.md` frontmatter `name`. Keep the skill self-contained when it is meant for third-party agent platforms; do not require repository-local files at runtime.
