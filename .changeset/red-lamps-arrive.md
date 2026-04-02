---
"@lynx-js/react": patch
---

Support rstest for testing library, you can use rstest with RLTL now:

Create a config file `rstest.config.ts` with the following content:

```ts
import { defineConfig } from '@rstest/core';
import { withLynxConfig } from '@lynx-js/react/testing-library/rstest-config';

export default defineConfig({
  extends: withLynxConfig(),
});
```

`@lynx-js/react/testing-library/rstest-config` will automatically load your `lynx.config.ts` and apply the same configuration to rstest, so you can keep your test environment consistent with your development environment.

And then use rstest as usual:

```bash
$ rstest
```

For more usage detail, see https://rstest.rs/
