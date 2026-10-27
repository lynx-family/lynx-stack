---
applyTo: "packages/react/runtime/src/**"
---

With `experimental_reEvalJSOnReload`, a reload evaluates the entry again and every module-level variable starts over, while the native tree, native lists, cross-thread event hosts and the worklet runtime stay alive. Declare module-level state with `cardLifetime` when it mirrors one of those survivors or holds IDs that late cross-thread messages may carry; any other state is meant to reset. Never capture `lynx` at module load in reload code: read it when needed, because tests swap it.
Keep the re-evaluation flow in `core/entry-reload.ts`. A backend only supplies the cleanup that stops a retired entry from reaching the new tree and the main-thread completer that renders into the retained page. Cross-thread entry points must check `isRuntimeDestroyed()` before registering a call, and listeners an entry installs must be removed by a destroy task.
The worklet runtime is initialized once per card and must stay unaware of reloads.
When composing entry re-evaluation with reload-scoped communication, advance the main-thread reload version before evaluating the replacement entry. Element Template must first finish old ref cleanup; its re-evaluation branch must not return before advancing the version.
Test re-evaluation by evaluating it for real: `packages/webpack/react-webpack-plugin/test/experimental-re-eval.test.ts` runs a built main-thread bundle through the reloader, and the runtime tests re-import modules with `vi.resetModules()` on one `lynx` with an event host that keeps every listener. Check a new test by reverting the fix it guards.
