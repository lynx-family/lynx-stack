---
applyTo: "examples/react-externals/**"
---

Keep the React externals example's External Bundle DebugMetadata flow directly runnable. Configure `pluginLynxDebugMetadata` with JavaScript source maps in `rslib-comp-lib.config.ts`, and retain a dedicated script using `DEBUG=rspeedy` so local users can inspect `dist-external-bundle/debug-metadata.json` without changing the ordinary production build's cleanup behavior. Describe section matching using actual emitted TASM `customSections` keys, never application-specific filename rules.
