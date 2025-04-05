---
"@lynx-js/rspeedy": minor
---

**BREAKING CHANGE**: Added explicit TypeScript peer dependency requirement of 5.1.6 - 5.8.x.

This formalizes the existing TypeScript version requirement in `peerDependencies` (marked as optional since it is only needed for TypeScript configurations). The actual required TypeScript version has not changed.

Note: This may cause installation to fail if you have strict peer dependency checks enabled.

Node.js v22.7+ users can bypass TypeScript installation using `--experimental-transform-types` or `--experimental-strip-types` flags. Node.js v23.6+ users don't need any flags. See [Node.js - TypeScript](https://nodejs.org/api/typescript.html) for details.
