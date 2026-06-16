---
"@lynx-js/web-core": minor
---

Support `lynx.fetchBundle` and `lynx.loadScript` for async external bundles on the web platform.

`@lynx-js/externals-loading-webpack-plugin` (and the `@lynx-js/external-bundle-rsbuild-plugin` wrapper) can now load external `.lynx.bundle` dependencies at runtime on web. Both APIs are available on the `lynx` object in the main-thread and background JS realms, and the main-thread `__LoadStyleSheet`/`__AdoptStyleSheet` APIs adopt an external bundle's CSS section onto the lynx view.

Notes/limitations:

- Only the async usage is supported (`async: true`); the synchronous `promise.wait()` usage is not available on web.
- External bundles whose main-thread section is compiled to `JsBytecode` cannot be executed on web — only plain-JS main-thread sections are supported. Background sections always work.
- Binary `.lynx.bundle` custom sections are not decoded yet; the runtime reads the decoded `{ content }` section shape (e.g. JSON-delivered bundles) today.
