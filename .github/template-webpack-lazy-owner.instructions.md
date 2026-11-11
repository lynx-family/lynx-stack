---
applyTo: "packages/webpack/template-webpack-plugin/**/*"
---

Use the compilation-scoped lazy bundle owner mapping to decide whether chunk filenames, runtime URLs, and template JavaScript selection treat a chunk as a lazy bundle. Preserve existing intermediate layout naming when multiple import groups refer to the same owned chunk; layout group order and runtime URL naming have historically used different precedence. A chunk used by an initial entry or a different lazy bundle must retain ordinary chunk loading; a chunk name from splitChunks is not evidence of lazy bundle ownership. Include shared CSS in each template that needs it. When checking ownership, account for multiple import groups resolving to the same resource, and preserve explicit async import naming behavior.

Regression tests for runtime lazy-bundle mappings should check the complete generated URLs and confirm each URL names an emitted template, as well as excluding shared chunk IDs. Checking only map keys or entry counts can miss incorrect bundle destinations.

Add new scenarios as separate tests and fixtures. Preserve existing regression inputs and assertions; if they fail after an implementation change, investigate the implementation before changing the test.

The encode hooks expose intermediate directories built with the host's path separators. Normalize backslashes to forward slashes before comparing these directories with emitted asset paths in cross-platform tests.
