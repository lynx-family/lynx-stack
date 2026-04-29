---

---

fix(build): re-add `//#build` (root `tsc --build`) as a dependency of every package's `build` task.

Without it, the root `tsc --build` step that produces `lib/` directories
across composite TypeScript projects never runs, so packages whose
`package.json` `types` points at `./lib/*.d.ts` (e.g. `@lynx-js/rspeedy`)
fail to resolve their type declarations from clean CI builds (`TS2307:
Cannot find module '@lynx-js/rspeedy'`).
