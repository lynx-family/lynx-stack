---
"@lynx-js/web-core": minor
---

`lynx.reload(value)` now accepts the optional `value` argument, which becomes the reloaded page's new initial data — previously it was ignored and the page always reloaded with the existing data. `LynxViewElement.reload(value)` takes the same optional argument.

The `callback` argument documented for native remains unsupported on web and now logs a warning when passed: reloading disposes the background thread the callback belongs to, so nothing scheduled there can observe the reloaded page.
