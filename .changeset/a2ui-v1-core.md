---
"@lynx-js/genui": minor
---

Add a lean A2UI v1.0 core path across the server and ReactLynx client. New
surfaces can carry their initial data model and components in one
`createSurface` message, data-model `null` values delete their target, and
actions use the v1.0 `action` envelope. The client continues to render
legacy v0.9 core messages during migration.
