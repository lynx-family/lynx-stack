---
"@lynx-js/genui": minor
---

Added an `includeDefaultComponents` option to `createOpenUiLibrary`. Set it to
`false` to build a Library only from caller-provided definitions and component
groups. The new `openui/explicit` entry and per-component catalog subpaths let
applications keep unselected built-ins outside their static dependency graph.
