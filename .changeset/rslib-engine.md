---
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/rsbuild-plugin": patch
---

Apply the Lynx build engine to `rslib` builds: module resolution, SWC transforms, bundler target, output, minification (JS and CSS), source maps and debug metadata now match an application build. The plugins that load or serve a bundle stay off, since `rslib` assembles its own.
