---
"@lynx-js/rspeedy": patch
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/react-webpack-plugin": patch
"@lynx-js/template-webpack-plugin": patch
---

Enable fine-grained control for `output.inlineScripts`

```ts
type InlineChunkTestFunction = (params: {
  size: number;
  name: string;
}) => boolean;

type InlineChunkTest = RegExp | InlineChunkTestFunction;

type InlineChunkConfig =
  | boolean
  | InlineChunkTest
  | { enable?: boolean | 'auto'; test: InlineChunkTest };
```

```ts
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  output: {
    inlineScripts: ({ name, size }) => {
      return name.includes('foo') && size < 1000;
    },
  },
});
```
