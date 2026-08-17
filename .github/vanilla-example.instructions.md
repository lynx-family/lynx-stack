---
applyTo: "examples/vanilla/**"
---

- Create the page with `__CreatePage`, append an `__CreateView` content container, and apply layout styles to the container. Applying `flex-direction` directly to the page root can produce a horizontal layout on Web.
- Register performance observers when the background module initializes and disconnect them during lifetime cleanup so startup entries are not missed.
- For each measured update, generate pipeline options on the background thread, set their origin, DSL, and stage, start the pipeline, bind a unique `__lynx_timing_flag`, send the options with the UI patch, and pass them to `__FlushElementTree`. Report `pipelineEnd - pipelineStart`, then remove the pending update.
- Use `__lynx_timing_actual_fmp` only for the page's one-time Actual FMP. Keep complete performance entries on the background thread and send only formatted summaries to the main thread to avoid measurement feedback loops.
