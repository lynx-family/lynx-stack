---
applyTo: "packages/react/**"
---

Keep compiler-injected capture helpers available from both Snapshot and Element Template internal entries. Implement the Element Template helper locally as an undefined-returning fallback because that backend cannot create snapshot MainThreadObject handles; never import snapshot-private modules from the Element Template entry. Cover ordinary member captures without MainThreadObject usage in Element Template bundle tests. Before inspecting or traversing a captured object, recognize realized MainThreadObject targets through runtime-owned weak metadata; shared capture containers can already contain targets with cycles, proxy traps, or user-owned metadata-shaped properties. Expose MainThreadObject APIs through the existing React entry, without a dedicated public subpath.
