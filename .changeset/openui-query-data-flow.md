---
"@lynx-js/genui": patch
"@lynx-js/skill-lynx-openui": patch
---

Guide generation to keep mutable
business content in Query results and update it through Mutation and Query
refresh. Include the local data tool contract in the shared default OpenUI prompt
only when the host declares both local data tools and tool calls are enabled. Execute preview mutations deterministically in local storage without
model requests. Keep conversation history and shares as plain DSL with Query defaults. Restore
saved local data only through the host renderer’s initialQueryResults input.
