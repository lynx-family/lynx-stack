---
applyTo: "examples/react-reload-lab/**"
---

Keep globalProps regression controls on the native test module APIs, leaving destruction to the real reload lifecycle. Display the received timestamp in human-readable form and exercise ordinary updates, consecutive update/reload calls, and globalProps passed directly to reloadTemplate. Ref checks should invoke a native view method so stale ref attachment is observable. Keep temporary runtime timing instrumentation out of the example's required runtime dependencies.
