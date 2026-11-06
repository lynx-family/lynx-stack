---
'@lynx-js/rsbuild-plugin': patch
'@lynx-js/react-rsbuild-plugin': patch
---

Include the Object.hasOwn shim through SWC's builtin includes for Lynx environments and preserve builtin includes in ReactLynx's main-thread loader without changing its syntax baseline. Supply core-js as a plugin dependency and resolve the shim when the application has no core-js installation. Add no pre-entries, exclude core-js itself from compilation, and honor `tools.swc.env.exclude` for the internal rule.
