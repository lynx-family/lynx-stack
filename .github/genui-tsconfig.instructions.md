---
applyTo: "packages/genui/**/*"
---

When adding a new package under `packages/genui`, add a package-level `tsconfig.json` and wire it into `packages/genui/tsconfig.json` references in the same change. Root type-aware ESLint uses the TypeScript project service, so new GenUI source files that are not reachable from those references will fail pre-commit parsing before code linting even starts.

When maintaining hand-written ESM CLI bin files under `packages/genui`, make entrypoint detection resolve `process.argv[1]` through `fs.realpathSync()` before comparing it with `import.meta.url`. pnpm `.bin` shims invoke workspace bins through symlink paths, and a raw path comparison can load the module without executing the CLI, making build scripts appear successful while generated artifacts are missing.

When a GenUI package exports ReactLynx TSX components that are later bundled by Rspeedy, keep TypeScript JSX emit as `preserve` so the ReactLynx transform can still process JSX props such as `className`, events, and styles. Runtime imports that point at TSX modules should use the emitted `.jsx` extension, matching the A2UI catalog pattern.

GenUI renderer declarations must resolve React types through `@lynx-js/react`. Explicitly annotate exported `memo` results with `MemoExoticComponent` and contexts with `Context` imported from ReactLynx; inference can otherwise emit undeclared `import("react")` references. Use public prop and return types in memo annotations rather than `typeof` a private implementation function, which causes TypeDoc missing-reference warnings. Inspect all emitted A2UI and OpenUI declarations and validate a packed umbrella package with React 18 and React 19 consumers and an unrelated private-hoisted type version before removing direct `@types/react` dependencies.

Check the Playground Web shell and Lynx renderer as separate no-emit projects with `pnpm --filter genui-playground test:type`, and run this check in its build script. The Web tsconfig must not reference the no-emit Lynx project: TypeScript project references require emitted declarations. Keep the Lynx JSX runtime and types in its own config, without composite output requirements. Include every checked build/test configuration file in Turbo inputs. Import `@lynx-js/react` before augmenting `@lynx-js/types` in renderer environment declarations so GlobalProps extensions preserve ReactLynx's StandardProps children/ref augmentation. Keep source and test files in type checking; update stale mocks and narrow optional results instead of excluding tests or weakening strictness.
