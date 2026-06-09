---
"@lynx-js/rspeedy": minor
---

Enable TypeScript type checking by default via `@rsbuild/plugin-type-check`.

Rspeedy now type-checks your project against its `tsconfig.json` during `build`/`dev`. If your project already has pre-existing type errors within the `tsconfig` scope, the build will now report them.

**Migration** — in order of preference:

1. **Fix the reported errors.** They are real type errors that were previously going unchecked.

2. **Grandfather files you can't fix yet** by excluding them in `tsconfig.json`, so everything else stays checked:

   ```jsonc
   {
     // ...
     "exclude": ["./src/legacy-file.ts"]
   }
   ```

3. **As a last resort, disable type checking** by adding your own `pluginTypeCheck()` — a user-provided instance takes precedence over the built-in one:

   ```js
   import { defineConfig } from '@lynx-js/rspeedy';
   import { pluginTypeCheck } from '@rsbuild/plugin-type-check';

   export default defineConfig({
     plugins: [
       pluginTypeCheck({ enable: false }),
     ],
   });
   ```
