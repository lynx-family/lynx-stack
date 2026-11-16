---
applyTo: ".github/workflows/test.yml"
---

Generate pnpr's hosted-registry rules from every public workspace package before `snapshot.js` renames the packages. Keep the rules exact: pnpr does not fall through to an upstream registry after a hosted rule matches, so a broad `@lynx-js/*` rule would hide stable npmjs dependencies that are not published by the smoke test.
Use a fresh storage directory with `pnpm publish --batch --force` so every canary package tested by the generated projects comes from the current build.
Enable pnpr's resolver with an ephemeral local account, pass its token through `PNPM_CONFIG_NPMRC_AUTH_FILE`, and give the generated pnpm 11 smoke-test projects typed `pnprServer`, `strictDepBuilds`, and `minimumReleaseAge` workspace settings.
Keep both `NO_PROXY` and `no_proxy` configured for `localhost` and `127.0.0.1`.
Read the repository's `packageManager` before entering temporary projects and copy its complete value, including the integrity hash, into generated pnpm projects before running their commands. Leave npm and Yarn projects unchanged so Corepack does not select a different pnpm version outside the workspace.
