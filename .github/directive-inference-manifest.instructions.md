---
applyTo: "{packages/**/directive-inference.json,packages/**/package.json,packages/**/src/**/*.ts,packages/**/src/**/*.tsx}"
---

Package auto-workletization declarations use the versioned `lynx.directiveInference` package metadata channel. Prefer branded public types as the source and regenerate the sidecar with `packages/react/transform/scripts/generate_directive_inference_manifest.mjs`; do not hand-maintain API policy in compiler source.

Keep manifest entries keyed by exact import source plus exported identity. Structural paths may designate direct leaves (`true`), direct container leaves (`"*"`), recursive container leaves (`"**"`), or exact object/array paths. Package builds must keep the sidecar in published files.
