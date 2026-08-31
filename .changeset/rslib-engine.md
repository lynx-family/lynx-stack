---
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/rsbuild-plugin": patch
---

Apply the Lynx build engine to `rslib` builds: module resolution, SWC transforms, output and debug metadata now match an application build. The plugins that shape or serve a bundle stay off, since `rslib` assembles its own.
