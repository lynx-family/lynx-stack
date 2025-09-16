---
"@lynx-js/web-core": minor
---

break(web): temporary remove support for chunk split

Since the global variables cannot be accessed in the splited chunk, we temporary remove supporting for chunk spliting

Developers could easily remove the chunk Split settings in Rspeedy for migration

```
import { defineConfig } from '@lynx-js/rspeedy'

export default defineConfig({
  performance: {
    chunkSplit: {
      strategy: 'all-in-one',
    },
  },
})
```
