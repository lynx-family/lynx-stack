---
"@lynx-js/web-mainthread-apis": minor
"@lynx-js/web-worker-runtime": minor
"@lynx-js/web-constants": minor
"@lynx-js/web-elements": minor
"@lynx-js/web-core": minor
---

refactor: remove web-elements/lazy and loadNewTag

- remove @lynx-js/web-elements/lazy
- remove loadElement
- remove loadNewTag callback

**This is a breaking change**

Now we removed the default lazy loading preinstalled in web-core

Please add the following statement in your web project

```
import "@lynx-js/web-elements/all";
```
