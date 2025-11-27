---
"@lynx-js/react-alias-rsbuild-plugin": minor
---

**BREAKING CHANGE**: Use resolver from Rspack.

The `createLazyResolver` now requires an `rspack` parameter which

```diff
- function createLazyResolver(directory: string, conditionNames: string[]): (request: string) => Promise<string>;
+ function createLazyResolver(rspack: rspack, directory: string, conditionNames: string[]): (request: string) => Promise<string>;
```
