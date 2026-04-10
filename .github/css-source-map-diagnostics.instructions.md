---
applyTo: "packages/{tools/css-serializer,webpack/template-webpack-plugin,rspeedy/core}/**"
---

When adding CSS diagnostics or source map plumbing across Rspeedy, css-serializer, and the template webpack plugin, preserve bundle-space `loc` data during debundle so warnings can be remapped through the main CSS source map back to original source files. Keep `cssSource` stable as `/cssId/<id>.css`, and only surface real source filenames in diagnostics when the mapped source path resolves to an existing file.
