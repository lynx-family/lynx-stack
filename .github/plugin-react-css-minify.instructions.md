---
applyTo: "packages/rspeedy/plugin-react/**"
---

When `enableRemoveCSSScope` is explicitly set to `false`, force CSS minification off by overriding `output.minify.css` to `false` after the default Rspeedy minify config has been applied. Do not rely on the core default CSS minify behavior here, because `pluginMinify` still enables CSS minification by default for the general case.

Keep the behavior scoped to ReactLynx/plugin-react integration. If you change the CSS minify flow, add or update regression tests in `packages/rspeedy/plugin-react/test/css.test.ts` for both `enableRemoveCSSScope: false` and `enableRemoveCSSScope: true` so the override only applies to the false case.
