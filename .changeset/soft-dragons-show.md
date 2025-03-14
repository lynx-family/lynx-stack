---
"@lynx-js/web-mainthread-apis": minor
"@lynx-js/web-core": minor
---

feat: use shadowroot to isolate one lynx-view

Before this commit, we have been detecting if current browser supports the `@scope` rule.
This allows us to scope one lynx-view's styles.

After this commit we always create a shadowroot to scope then.

Also for the new shadowroot pattern, we add a new **attribute** `inject-head-links`.
By default, we will iterate all `<link rel="stylesheet">` in the `<head>`, and use `@import url()` to import them inside the shadowroot.
Developers could add a `inject-head-links="false"` to disable this behavior.
