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
