---
"@lynx-js/template-webpack-plugin": patch
"@lynx-js/web-webpack-plugin": patch
---

Be compatible with rspack-manifest-plugin.

Now only the `[name].lynx.bundle` and `[name].web.bundle` would exist in `manifest.json`.

See [lynx-family/lynx-stack#763](https://github.com/lynx-family/lynx-stack/issues/763) for details.
