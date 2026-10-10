---
applyTo: "packages/genui/server/**,packages/genui/playground/**,packages/genui/openui/src/openui-prompt/**"
---

OpenUI Create uses the shared text route's line delta framing. Preserve newline bytes, combine upstream token fragments, emit each complete line immediately, and flush the final unterminated line before finalization. Keep model events and cancellation independent of this buffer. Show each bounded stream delta as its own Raw output entry in the shared Agent interaction timeline, preserving reception order and per-chunk arrival time, and include retained chunks in Copy details.

Keep image-source guidance active even when search and image generation are unavailable. Do not teach fabricated media URLs in default OpenUI examples. Validate resolved Image sources, including state variables and Query defaults, against user/host inputs and the current request's image-tool results. Withhold unauthorized or incomplete image sources during streaming and retain usage when final validation fails. Reuse the capability RequestContext for validation; never authorize an image just because its URL uses HTTPS or appears in assistant history.

When the Playground development payload store is enabled, publish conversation shares through its existing same-origin store. Development payloads expire after thirty minutes and on server restart; do not persist their URLs as durable share-cache entries. Production shares continue through GenUI Server storage. Display publication errors separately from clipboard failures.

OpenUI component arguments follow the ordered schema, including optional alias slots. Teach `null` placeholders for skipped middle arguments in both full and reduced-vocabulary prompts. For List, preserve `children, items, direction, align, gap, divider`; a children-based layout call must retain the second items slot as `null`. Validate documented positional examples against both the headless prompt and renderer libraries rather than relaxing enum validation or guessing shifted values at runtime.
