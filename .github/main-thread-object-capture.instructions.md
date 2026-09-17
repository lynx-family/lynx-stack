---
applyTo: "packages/react/**"
---

Keep MainThreadObject handle creation, metadata, and compiler-injected capture helpers in backend-neutral core modules so Snapshot and Element Template share one handle identity. Never import snapshot-private modules from the Element Template entry. Cover Element Template with a compiled execution test that creates a typed object, transports its initialization payload, captures it in a main-thread function, and invokes the realized target. Before inspecting or traversing a captured object, recognize realized MainThreadObject targets through runtime-owned weak metadata; shared capture containers can already contain targets with cycles, proxy traps, or user-owned metadata-shaped properties. Expose MainThreadObject APIs through the existing React entry, without a dedicated public subpath.
