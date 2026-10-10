---
applyTo: "examples/react-lazy-bundle-share-common-chunks/**"
---

Keep this example's `rsbuild.config.ts` in TypeScript with the `shared` cache group enabled by default. The QRCode plugin exposes the dev bundle. The repository root already ignores `*.tsbuildinfo`, and hot-update files are emitted under the ignored `dist/` directory, so neither needs a local ignore rule.
