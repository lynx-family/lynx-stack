---
"@lynx-js/template-webpack-plugin": patch
---

Replace every `[name]` in a custom `lazyBundleFilename`. The substitution used a non-global regular expression, so a template like `lazy-bundle/[name]/[name].[fullhash].bundle` kept the second `[name]` as a literal path segment.
