---
"@lynx-js/config-rsbuild-plugin": minor
---

Upgrade `@lynx-js/type-config` to `4.4.0` and support `preferredFps` in `pluginLynxConfig`.

**BREAKING CHANGE**: `pluginLynxConfig` rejects `enableNewIntersectionObserver`. Remove it from your configuration. If your app still relies on the legacy observer implementation in an older Lynx SDK, keep using the previous plugin release until you can upgrade the SDK.
