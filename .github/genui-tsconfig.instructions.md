---
applyTo: "packages/genui/**/*"
---

When adding a new package under `packages/genui`, add a package-level `tsconfig.json` and wire it into `packages/genui/tsconfig.json` references in the same change. Root type-aware ESLint uses the TypeScript project service, so new GenUI source files that are not reachable from those references will fail pre-commit parsing before code linting even starts.

When maintaining hand-written ESM CLI bin files under `packages/genui`, make entrypoint detection resolve `process.argv[1]` through `fs.realpathSync()` before comparing it with `import.meta.url`. pnpm `.bin` shims invoke workspace bins through symlink paths, and a raw path comparison can load the module without executing the CLI, making build scripts appear successful while generated artifacts are missing.

When a GenUI package exports ReactLynx TSX components that are later bundled by Rspeedy, keep TypeScript JSX emit as `preserve` so the ReactLynx transform can still process JSX props such as `className`, events, and styles. Runtime imports that point at TSX modules should use the emitted `.jsx` extension, matching the A2UI catalog pattern.
