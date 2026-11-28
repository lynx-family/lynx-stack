---
applyTo: "examples/islands-producer/**,examples/islands-consumer/**"
---

Keep the producer and consumer as separate workspace projects. The producer combines pluginLynx and pluginIslands with exposes and output.mode remote, without ReactLynx, a React plugin or an application entry. The shared plugin-lynx template pipeline emits a resource with main, background and CSS sections, not a standalone page. The consumer uses the same Island component as inline integration, with name and an absolute entry URL. Do not import producer XML or add a producer package dependency or a consumer build dependency on the producer. Keep ISLAND_ENTRY and LYNX_HOST in the consumer's Turbo build environment. Include update and unmount/remount actions so late loading and instance lifecycle can be exercised.
