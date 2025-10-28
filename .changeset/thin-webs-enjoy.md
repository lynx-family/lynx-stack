---
"@lynx-js/template-webpack-plugin": patch
---

Remove `compiler.hooks.initialize` as [it's not called in child compilers](https://github.com/web-infra-dev/rspack/blob/aa4ad886b900770787ecddd625d3e24a51b6b99c/packages/rspack/src/rspack.ts#L78).
