---
applyTo: "packages/genui/server/**"
---

Keep the A2UI production `start.sh` at the package root. The launcher and server process must directly consume `HOST` and `PORT`, preserving direct overrides and the existing defaults.
