---
"@lynx-js/rsbuild-plugin": patch
---

Turn Rsbuild's lazy compilation off for a Lynx build, which cannot run the proxy module it serves in place of a dynamic import.

Apply the dev plugin to `rsbuild preview` as well, so it prints the bundle URLs and resolves `dev.assetPrefix` to an address a device can reach. Rspeedy never needed this because it initializes its plugins before the action is known, which leaves the plugin's `apply` filter out of the picture.
