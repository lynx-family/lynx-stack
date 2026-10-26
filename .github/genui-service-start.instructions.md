---
applyTo: "packages/genui/server/**"
---

Keep the A2UI production `start.sh` at the package root. The launcher and server process must directly consume `HOST` and `PORT`, preserving direct overrides and the existing defaults.

Set Node's default address-family connection attempt timeout to at least 2000 ms in `packages/genui/server/src/index.ts` before starting the server. Preserve an existing longer timeout. Some deployments need more than Node's default 250 ms to establish an IPv6 connection and have no usable IPv4 route. Keep this setting in the server entry point so deployments do not need `NODE_OPTIONS`; retain automatic address-family selection and request-level deadlines.
