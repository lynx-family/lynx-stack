---
applyTo: ".github/workflows/test.yml"
---

Generate pnpr's hosted-registry rules from every public workspace package before `snapshot.js` renames the packages. Keep the rules exact: pnpr does not fall through to an upstream registry after a hosted rule matches, so a broad `@lynx-js/*` rule would hide stable npmjs dependencies that are not published by the smoke test.
Use a fresh storage directory with `pnpm publish --batch --force` so every canary package tested by the generated projects comes from the current build.
Keep pnpr's resolver disabled while the generated smoke-test projects use pnpm 10, and keep both `NO_PROXY` and `no_proxy` configured for `localhost` and `127.0.0.1`.
