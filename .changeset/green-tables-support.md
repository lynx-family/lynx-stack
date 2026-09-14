---
'@lynx-js/genui': minor
---

**Breaking change:** Migrate the ReactLynx renderer and GenUI server to A2UI v1.0 only. Reject older protocol messages and action requests; regenerate existing v0.9 streams and send versioned action envelopes. Replace imports from `@lynx-js/genui/a2ui/0.9` with `@lynx-js/genui/a2ui` or `@lynx-js/genui/a2ui/1.0`. Support inline surface initialization, typed data-model replacement and deletion, structured validation results, and catalog-scoped function messages. Preserve v1.0 state when compacting snapshots and expose an `onMessage` callback for protocol events and transport metadata.
