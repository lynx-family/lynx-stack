---
applyTo: "packages/genui/{a2ui,server}/**"
---

Support only A2UI v1.0. Reject older and versionless protocol envelopes at message and action ingress; do not add version negotiation or legacy data-model/action branches. Expand inline createSurface initialization through the existing component/data handlers, emit v1.0 on streamed loading placeholders and snapshots, and apply the same source validation to inline components as updateComponents. Reject duplicate creation before expanding its embedded updates.

For v1.0 data models, preserve JSON scalar types and update ancestor containers as well as descendant signals on subtree replacement or null deletion. Snapshot compaction must retain typed containers and collection context. Forward action and function events through onMessage with transport metadata; keep onAction compatible with the existing payload callback.

Resolve remotely invoked renderer functions against an explicitly registered catalog and enforce allowedCallers, defaulting to rendererOnly. Keep functionCallId unchanged in responses. The GenUI service currently has no agent-side catalog functions; return UNKNOWN_FUNCTION without asking a model to simulate execution. Preserve SSE framing for RPC replies on the streaming endpoint.

Catalog generation and serialization use protocolVersion 1.0, $id, and maps of component/function schemas. Put function returnType and allowedCallers outside properties; function calls carry only call, catalogId, and args. The pinned upstream dependency is used only for basic function implementations and argument schemas, never its message processor or capabilities envelope. Adapt built-in validation functions to ValidationResult objects.
