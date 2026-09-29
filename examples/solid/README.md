# SolidLynx

This example uses one SolidJS source entry for both Lynx threads. The
`@lynx-js/solid-rsbuild-plugin` compiles the JSX with Solid's universal
renderer and emits the main-thread and background-thread bundle sections.

The background thread owns signals and reconciliation. The main thread applies
the resulting Element Template commands with Element PAPI.

## Run

```bash
pnpm --filter @lynx-js/example-solid dev
```

## Build

```bash
pnpm --filter @lynx-js/example-solid build
```
