---
applyTo: "packages/genui/server/**,packages/genui/playground/**,packages/genui/openui/**"
---

OpenUI text generation streams through `OpenUIAgentService.streamAsAsyncIterable` and `/openui/stream`. Forward each model chunk as a `delta` before finalization; `done.text` remains authoritative. Create and action adapters publish cumulative raw DSL snapshots with `isStreaming: true` and only mark completion after `done`. Do not turn an interrupted stream into a successful final artifact.

Keep OpenUI Create's iframe URL on an empty `liveStream` bootstrap throughout generation and completion, including large published results. Use the shared live preview delivery queue and runtime-ready navigation token handshake; the OpenUI Web bridge translates its payload into `OPENUI_LIVE_RESPONSE` for the existing Lynx renderer. Coalesce snapshots while that runtime boots. Update `response` and `isStreaming` together in React state and pass them to OpenUiRenderer. Final snapshots must clear `isStreaming` even when their text equals the last partial so interactions and completion validation resume. Keep examples and playback on their existing simulated path, and keep share/native source URLs independent of the live iframe URL.

Use accumulated `response` and `isStreaming` as the OpenUI model-output API. Do not add an input message store or depend on the A2UI store. The renderer owns a stable streaming parser: completed statements are cached and the unfinished tail is reparsed, while preprocessing and result rebuilding still occur on text updates. Keep Library identity stable. Replaced text resets parsing; changing only the streaming flag does not rerun parsing.

Keep transport and cancellation handling in the host. On failure or cancellation clear incomplete text instead of marking it complete and enabling queries or actions. Stop old requests and reject late events before starting a new generation. Clearing response does not cancel requests or reset runtime form state; use a new renderer key when a fresh session should reset state.

Keep the OpenUI English and Chinese READMEs and overviews aligned. Explain accumulated text versus deltas, atomic text/state updates, authoritative completion, cancellation, and session reset. Renderer users need no second parser; reserve `createStreamingParser().push(delta)` and `.set(fullText)` for standalone parsing.
