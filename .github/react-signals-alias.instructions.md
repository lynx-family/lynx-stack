---
applyTo: "packages/rspeedy/plugin-react-alias/**"
---

Keep the Preact singleton guarantee covered by the real-build `preact-singleton` fixture. The fixture must install separately marked Preact packages under the selected `@lynx-js/react` and `@lynx-js/react-signals`, build a background-layer entry through `pluginReactAlias`, and assert that only the React-selected Preact markers reach the bundle.
