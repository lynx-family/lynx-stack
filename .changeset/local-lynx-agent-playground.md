---
"@lynx-js/genui": minor
---

Add `genui playground`, a macOS local daemon that connects the Lynx XML
playground to Codex, Claude Code, Cursor Agent, or Trae CLI installed on the
user’s machine. The command includes durable conversations, streaming,
cancellation, explicit approvals, process-group cleanup, a credential-free
isolated Preview origin, hardened local storage, and deterministic protocol and
browser probes. Its control page reuses the hosted Playground React views and
CSS, with a minimal local-only Agent transport and control slice.
High-frequency assistant deltas are coalesced without changing the authoritative
final artifact, while real Agent queues, durable event logs, and slow SSE
subscribers remain independently bounded.
The local settings pill now keeps Agent, dynamically discovered Model, and
Effort controls together. Codex, Cursor Agent, and Trae CLI catalogs are loaded
on demand and validated before launch; Claude Code continues to use its locally
configured default because it does not expose model enumeration.
