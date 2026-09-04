---
"@lynx-js/debug-metadata-rsbuild-plugin": patch
---

File each main thread chunk's bytecode debug info under the artifact it was compiled from, and name that artifact after the section carrying it. A bundle whose main thread code lives in `JsBytecode` custom sections had every unit the encoder produced piled onto its first main thread artifact, keyed by section name, while the other entries got none; each artifact was also reported as the file it was assembled from, `<name>.js`, rather than the `<name>` a stack frame carries.
