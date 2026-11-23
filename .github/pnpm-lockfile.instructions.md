---
applyTo: "{pnpm-lock.yaml,package.json}"
---

Use the pnpm version pinned in package.json when updating the lockfile. Check `corepack pnpm --version` and prefer `corepack pnpm` if the shell's pnpm points to a different version. A frozen install alone does not verify canonical peer snapshots: run `corepack pnpm dedupe --check --lockfile-only` and `corepack pnpm peers check --lockfile-only`, matching CI, before committing lockfile changes.
