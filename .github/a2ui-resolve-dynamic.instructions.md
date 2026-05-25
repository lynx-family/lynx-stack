---
applyTo: "packages/genui/a2ui/src/**"
---

When resolving A2UI dynamic values, reuse the shared helpers in `src/store/resolveDynamic.ts` instead of reimplementing recursive object/array traversal or relative-path joining. Use `resolveDeepValue()` for nested value traversal and snapshot reuse, and `resolveBindingPath()` for any `dataContextPath`-relative store path normalization. Keep `resolveDynamicValue()` as the shared entrypoint for binding resolution, and pass `resolveFunctionCall` explicitly only in call sites that need nested function execution. Keep React-specific unsupported-prop handling and signal wrapping in the React/store layer, but do not duplicate the deep traversal logic across `useDataBinding`, `resolveFunctionCall`, `signalResolution`, or future dynamic-resolution entrypoints.
