# @lynx-js/lynx-xml

Parse a single-file LynXML document into its main-thread script, optional
background script and optional stylesheet. The parser has no runtime dependencies
and works in Node.js, browsers and workers.

```ts
import { parseLynxXML } from '@lynx-js/lynx-xml/parser';

const result = parseLynxXML(
  '<lynx engine-version="4.2"><script thread="main">render()</script></lynx>',
);
if (!result.success) throw new Error(result.error.formattedMessage);
const { mainThreadScript, backgroundThreadScript, style } = result;
```
