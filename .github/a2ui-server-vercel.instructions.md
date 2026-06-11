---
applyTo: "packages/genui/server/**"
---

When deploying the A2UI server to Vercel, treat it as a pnpm workspace package rather than a standalone npm package. The server depends on workspace packages such as `@lynx-js/ui-judge`, so Vercel deployments must include files outside `packages/genui/server` and run install/build commands from the repository root with pnpm. Do not replace `workspace:*` dependencies with registry versions merely to satisfy Vercel's default `npm install`.

For Vercel Git deployments, keep the build command narrow. Build `packages/genui/ui-judge` first, then `packages/genui/server`; avoid `pnpm turbo build --filter=a2ui-server...` or `pnpm --filter=a2ui-server... build` because the full workspace dependency closure is broader than this server deployment needs.
