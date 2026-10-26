---
applyTo: "packages/web-platform/web-core/ts/client/mainthread/{LynxViewInstance,Background}.ts,packages/web-platform/web-core/tests/background-startup.spec.ts"
---

Register background scripts for every bundle, but start the background runtime only after the entry bundle's `updateBTSChunk` RPC resolves. External and lazy manifests may arrive before the entry manifest; allowing them to start the runtime causes embedded entry modules to be requested from the network before registration. Keep regression coverage for non-entry bundles arriving first, pending entry registration, and failed entry registration.
