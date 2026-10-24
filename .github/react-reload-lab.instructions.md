---
applyTo: "examples/react-reload-lab/**"
---

Keep the reload lab separate from runtime feature changes. Use one Rsbuild config with environment variables for the backend and entry re-evaluation mode. Its lazy bundle URLs must use an address reachable by the device; include both modes, advertised host and port in Turbo's environment inputs and cache the dist output. For emulator checks, use loopback with an explicit adb reverse mapping.

Distinguish Snapshot's retained Element PAPI mutations from ET's rebuilt page children. Keep known ET bridge and native DevTool failures visible in the UI and README, and report them separately from passing reload checks. Element PAPI tracing is diagnostic instrumentation, not a performance benchmark.

Document ordinary reload separately from entry re-evaluation: React state resets in both modes, while ordinary reload retains the entry epoch and module-local values. Trace overflow labels must include both captured calls hidden by the UI and calls dropped by the recorder.

Start Element PAPI capture for every main-page reload control so data and globalProps reloads cannot merge into the preceding trace. Keep the native globalProps update and native reload consecutive, after capture has started.
