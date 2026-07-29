---
applyTo: "{start.sh,packages/genui/server/**,packages/genui/ui-judge/**}"
---

Deployment launchers map `REQUIRE_HTTP_MESH=True` to `LYNX_USE_HOST=127.0.0.1` and require `MESH_INGRESS_PORT` as `LYNX_USE_PORT`. Preserve direct host and port overrides plus each service's existing defaults outside the mesh. Map the selected values to the environment names consumed by each server; UI Judge must still bind both unspecified IPv4 and IPv6 addresses.
