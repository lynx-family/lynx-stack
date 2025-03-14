---
"@lynx-js/rspeedy": patch
---

Support configure the base path of the server.

By default, the base path of the server is `/`, and users can access lynx bundle through `http://<host>:<port>/main.lynx.bundle`
If you want to access lynx bundle through `http://<host>:<port>/foo/main.lynx.bundle`, you can change `server.base` to `/foo`

example:

```js
import { defineConfig } from '@lynx-js/rspeedy';
export default defineConfig({
  server: {
    base: '/dist',
  },
});
```
