---
applyTo: "packages/rspeedy/{core,plugin-lynx,plugin-react}/**"
---

Describe Lynx builtin API gaps through SWC env.include in the common SWC plugin without mode checks or pre-entries. Explicit builtin includes force imports even with SWC mode unset. Supply the shim dependency from the plugin and provide a resolver fallback so standalone applications need no additional dependency or configuration. Filter out internally included builtins listed in env.exclude because explicit includes otherwise take precedence over excludes.

Carry builtin includes (`es.*`, `esnext.*`, and `web.*`) through the ReactLynx main-thread loader while preserving its fixed syntax baseline. Exclude core-js itself from compilation to prevent recursive polyfill injection. Apply the engine policy only to Lynx environments.

Validate actual bundles in independent runtimes without the native builtin. Capture an Object.hasOwn call during entry evaluation, verify both threads, and cover unused APIs and explicit exclusions. Also build an isolated application that cannot resolve core-js itself to validate the plugin's resolver fallback. Avoid application-configured builtin includes or shims in these regressions.
