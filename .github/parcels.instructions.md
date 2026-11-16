---
applyTo: "packages/parcels/**"
---

Keep the Parcel runtime independent of the host DSL and the source compiler.
Put ReactLynx worklet and thread-dispatch code in the `/runtime/react`, Rsbuild
and TASM code in `/compiler`, and Lynx XML parsing in `/compiler/lynx-xml`. Other
source compilers supply native scripts and stylesheet rules, and other hosts
schedule the background helper through their own bridge. Use the same
namespaced sections for embedded and external delivery. The native main-thread
wrapper supplies a lexical `__lynxParcel` marker so dual-use documents can
avoid registering standalone page listeners inside any host.

Keep main readiness independent of background readiness. Fetch external
bundles separately on each thread and use the resolved URL as the bundle
identity. Use `__Card__` for embedded sections. Cache background initialization
by source and section prefix, clearing failures to allow retries. Subscribe to
the reply before dispatching and remove temporary listeners when they settle
or the page is destroyed. Keep native node handles, loaded exports, and
readiness promises on their owning threads.

Keep section naming in `/common` so the compiler and all host runtimes agree on bundle keys. The generic host mount API owns pending updates and cancellation.
