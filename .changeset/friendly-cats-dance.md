---
"@lynx-js/react": patch
---

Use `disableDeprecatedWarning` option to suppress BROKEN warnings during compilation.

1. BROKEN: `getNodeRef`/`getNodeRefFromRoot`/`createSelectorQuery` on component instance is broken and MUST be migrated in ReactLynx 3.0, please use ref or lynx.createSelectorQuery instead.
2. BROKEN: `getElementById` on component instance is broken and MUST be migrated in ReactLynx 3.0, please use ref or lynx.getElementById instead.
