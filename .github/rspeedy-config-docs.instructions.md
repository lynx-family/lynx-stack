---
applyTo: "packages/rspeedy/core/src/config/**/*.ts"
---

When documenting config types in `packages/rspeedy/core/src/config`, record the user-facing default value of the option in `@defaultValue` instead of describing it in `@remarks`. Verify each documented default against the local implementation or the referenced upstream Rsbuild behavior before writing it down. If an existing `@remarks` section explains the default behavior, move that information into `@defaultValue` and keep `@remarks` for non-default semantics, conditional runtime normalization, or tool-injected behavior that is not the option's direct default.
