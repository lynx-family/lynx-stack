---
applyTo: "packages/react/testing-library/**"
---

When using `@lynx-js/react-signals` in ReactLynx testing-library tests, read `.value` in JSX so signal changes rerender through the ReactLynx snapshot pipeline. Do not pass a Signal object directly as a JSX child: that optimization mutates a browser text node directly and does not update the Lynx element tree.

Consume Signals through `@lynx-js/react-signals`; do not add direct `@preact/signals`, `@preact/signals-core`, or `preact` dependencies. The adapter package owns the compatible implementation and peer resolution.

When changing React runtime error messages, search test sources and snapshots across packages and update testing-library consumers as well as runtime tests. The ctx-not-found listener snapshot in `src/__tests__/lynx.test.jsx` exercises the hydration path and includes its operation, commit ID, and hydration flag. Testing-library imports generated runtime and plugin artifacts, so run the full repository build before validating the `react/testing-library` project.

Testing runtime init aliases must be applied after runtime alias plugins, including the internal `lynx:react` wrapper that embeds the alias plugin. Declare that ordering on the testing plugin with `pre`; keep production plugins independent of testing-library. The exported Rstest config resolves to `dist/rstest-config.js`, so rebuild it before validating source changes through consumer tests.

Background function execution IDs remain increasing across runtime resets. In testing-library worklet transport snapshots, normalize numeric `_execId` values rather than assuming each test starts at 1 or recording IDs that depend on test order; retain the actual invocation and return-value assertions. Validate the complete `react/testing-library` project when changing runtime reset behavior, as it consumes built runtime artifacts.
