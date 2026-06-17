---

---

chore: migrate node/unit test suites from vitest to rstest

Migrates the test runner from vitest to rstest for the following packages
(test-only change, no published behavior): `@lynx-js/css-serializer`,
`@lynx-js/debug-metadata`, `@lynx-js/i18next-translation-dedupe`,
`@lynx-js/autolink-codegen`, `@lynx-js/create-lynx-library`,
`@lynx-js/tailwind-preset`, `@lynx-js/websocket`,
`@lynx-js/debug-metadata-rsbuild-plugin`, `@lynx-js/external-bundle-rsbuild-plugin`,
`@lynx-js/qrcode-rsbuild-plugin`, `@lynx-js/upgrade-rspeedy`,
`@lynx-js/webpack-dev-transport`, and the `examples/react` / `examples/tailwindcss`
typecheck suites.

Also migrates the ReactLynx-DOM testing suites — `@lynx-js/reactlynx-testing-library`,
`@lynx-js/gesture-runtime`, `@lynx-js/testing-environment`, and the
`testing-library/examples/*` suites — which run per-package in CI (they cannot be
aggregated into the root `rstest.config.ts`). The `vitestTestingLibraryPlugin`
export and `vitest.config` exemplars are intentionally retained for third-party
consumers who still test with vitest.
