---
applyTo: "packages/react/**"
---

Keep MainThreadObject handle creation, metadata, and compiler-injected capture helpers in backend-neutral core modules so Snapshot and Element Template share one handle identity. Never import snapshot-private modules from the Element Template entry. Cover Element Template with a compiled execution test that creates a typed object, transports its initialization payload, captures it in a main-thread function, and invokes the realized target. Before inspecting or traversing a captured object, recognize realized MainThreadObject targets through runtime-owned weak metadata; shared capture containers can already contain targets with cycles, proxy traps, or user-owned metadata-shaped properties. Expose MainThreadObject APIs through the existing React entry, without a dedicated public subpath.

Keep main-thread type registration, factory resolution, and realized-target metadata in the private worklet-runtime MainThreadObject module. Worklet ref maps hold both ordinary mutable cells and opaque targets; do not type every entry as a mutable cell. Validate protocol versions at registration and transport boundaries rather than duplicating an already-validated version in target metadata.

Compiler-generated method getters refresh receiver captures on each source read. Resolving a whole captured object must preserve those source getters while retaining a stable resolved context for hydration. Cover this contract with generated-code execution, not only transform snapshots or synthetic helper inputs. Nested method computed keys are evaluated in the enclosing worklet scope, before the nested method parameter scope.
