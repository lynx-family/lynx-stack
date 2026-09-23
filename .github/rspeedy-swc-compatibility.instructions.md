---
applyTo: "packages/rspeedy/{core,plugin-lynx}/**/*"
---

Keep runtime compatibility transforms in the shared Lynx SWC plugin in addition to the ES-version transform list. ES2017 syntax support does not imply freedom from engine bugs: SWC's object-rest parameter lowering can produce array rest which the production minimizer inlines to `[a, ...rest] = [arg0, arg1]`, a pattern affected by Safari before 14.1 and iOS before 14.5. Keep `transform-destructuring` enabled by default unless the toolchain gains an equivalent, verified workaround; SWC's `env.bugfixes` alone does not currently handle this case.

Validate compatibility changes using emitted JavaScript from the real Rspack loader and production minimizer, including object-rest parameters followed by another parameter. Check the emitted AST as well as parameter values, getter/default evaluation order, and iterable behavior. Passing execution tests in Node does not verify old JSC behavior; report device verification separately.
