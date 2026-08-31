---
"@lynx-js/rsbuild-plugin": minor
"@lynx-js/rspeedy": minor
"@lynx-js/css-extract-webpack-plugin": minor
"@lynx-js/template-webpack-plugin": minor
---

**BREAKING CHANGE**: Emit the intermediate files into `.lynx` instead of `.rspeedy`, since the directory is written by the Lynx build engine rather than by Rspeedy. The directory is no longer configurable: `output.distPath.intermediate` was documented as never read, and nothing else reads it now either.
