---
applyTo: "**/package.json"
---

Avoid `pnpm run --parallel` inside a package-local script when the intent is to run only that package's matching scripts. With pnpm 11, `--parallel` can fan out across workspace packages with matching script names and collide on sibling build outputs. Prefer `pnpm run "/^script:pattern$/"` for local regex script fan-out, or call the specific local scripts explicitly.
