---
"@lynx-js/react": patch
---

Add experimental `TransferRegistry` to `@lynx-js/react/internal`. Native hosts can render registered components as independent transfer instances; each instance renders its first frame on the main thread, hydrates on the background thread and sends ordered, acknowledged commits.
