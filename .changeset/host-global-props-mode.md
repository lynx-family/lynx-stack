---
'@lynx-js/react': patch
'@lynx-js/react-rsbuild-plugin': patch
---

Read GlobalProps mode from the host page's runtime configuration so lazy and external bundles use the host's mode. Preserve the `__GLOBAL_PROPS_MODE__` definition for historical consumers and retain the existing `globalPropsMode` build option. Hosts must inject the runtime mode to enable event mode in the new runtime.
