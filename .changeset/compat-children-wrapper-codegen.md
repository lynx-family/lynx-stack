---
"@lynx-js/react": patch
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/react-webpack-plugin": patch
---

Add `compat.legacySlot` to `pluginReactLynx`. When enabled, dynamic children are compiled to the pre-SlotV2 form (JSX `children` + `wrapper` elements + `__DynamicPartChildren`/`__DynamicPartSlot` symbols instead of `$0`/`$1` slot props + `SlotV2`), so the compiled output stays compatible with legacy runtimes without `SlotV2` support (`< 0.120.0`, which shipped the SlotV2 refactor in #1764) — e.g. a standalone lazy bundle consumed by a host App that ships an older runtime.

```js
import { defineConfig } from '@lynx-js/rspeedy';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

export default defineConfig({
  plugins: [
    pluginReactLynx({
      compat: {
        legacySlot: true,
      },
    }),
  ],
});
```

The default (SlotV2) codegen is unchanged, and the runtime keeps supporting both forms.
