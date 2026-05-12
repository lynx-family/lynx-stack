---
applyTo: ".github/workflows/{test,deploy-main}.yml"
---

Keep Playwright CI in `test.yml` and deploy Playwright coverage in `deploy-main.yml` on the macos-26 runner without GitHub Actions containers. Use Node.js 24. Install browsers with `pnpm --filter @lynx-js/web-elements exec playwright install --with-deps chromium firefox webkit` after `pnpm install --frozen-lockfile` and before build or test steps. Run Playwright as a two-entry matrix for `@lynx-js/web-elements` and `@lynx-js/web-core-e2e`; do not add a separate build-cache job or Playwright sharding. Keep `web-tests` out of this Playwright macOS migration until it is explicitly needed.
