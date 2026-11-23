---
applyTo: "packages/genui/a2ui/src/**"
---

When resolving A2UI dynamic values, reuse the shared helpers in `src/store/resolveDynamic.ts` instead of reimplementing recursive object/array traversal or relative-path joining. Use `resolveDeepValue()` for nested value traversal and snapshot reuse, and `resolveBindingPath()` for any `dataContextPath`-relative store path normalization. Keep `resolveDynamicValue()` as the shared entrypoint for binding resolution, and pass `resolveFunctionCall` explicitly only in call sites that need nested function execution. Keep React-specific unsupported-prop handling and signal wrapping in the React/store layer, but do not duplicate the deep traversal logic across `useDataBinding`, `resolveFunctionCall`, `signalResolution`, or future dynamic-resolution entrypoints.

When coercing catalog props for `useSyncExternalStore`, compare arrays and objects with the previous snapshot after coercing their children. Reuse a container only when its shape and child values match, including after a literal or bound array shrinks.

For render-time function calls, compare the final JSON prop after schema coercion, including union and schema-less props. Keep evaluating the call so it can track updated signal dependencies, and treat any directive-like keys in its result as data.
