---
applyTo: "packages/web-platform/web-core/ts/client/background/background-apis/createPerformanceApis.ts,packages/react/runtime/src/**/profile*.ts,packages/react/runtime/src/core/hooks/react.ts"
---

When maintaining web-core profiling APIs, preserve the ReactLynx profiling contract: `profileStart(traceName, option?)` and `profileEnd()` form a stack of nested traces, `profileMark(traceName, option?)` records an instant trace, `profileFlowId()` returns monotonic nonzero IDs, and `isProfileRecording()` should reflect whether the host profiling bridge is available. On web, bridge these APIs to browser User Timing by emitting measures for start/end pairs and marks for instant events, carrying ReactLynx `TraceOption` data through User Timing `detail`.
