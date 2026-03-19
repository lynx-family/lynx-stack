---
'@lynx-js/react-rsbuild-plugin': minor
"@lynx-js/react-webpack-plugin": minor
'@lynx-js/react': minor
---

feat: add `globalPropsMode` option to `PluginReactLynxOptions`

- When configured to `"event"`, `updateGlobalProps` will only trigger a global event and skip the `runWithForce` flow.
- Defaults to `"reactive"`, which means `updateGlobalProps` will trigger re-render automatically.
