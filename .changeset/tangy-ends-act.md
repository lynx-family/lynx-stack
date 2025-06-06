---
"@lynx-js/rspeedy": patch
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/react-webpack-plugin": patch
"@lynx-js/template-webpack-plugin": patch
---

Align `output.inlineScripts` with Rsbuild, except for `enable: 'auto'`

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
