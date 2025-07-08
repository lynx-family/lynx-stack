---
"@lynx-js/react": patch
---

Introduce `@lynx-js/react/debug` which would include debugging warnings and error messages for common mistakes found.

Add the import to `@lynx-js/react/debug` at the first line of the entry:

```js
import '@lynx-js/react/debug';
import { root } from '@lynx-js/react';

import { App } from './App.jsx';

root.render(
  <App />,
);
```
