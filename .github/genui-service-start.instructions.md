---
applyTo: "{start.sh,packages/genui/server/**,packages/genui/ui-judge/**}"
---

Deployment launchers map `REQUIRE_HTTP_MESH=True` to `LYNX_USE_HOST=127.0.0.1` and require `MESH_INGRESS_PORT` as `LYNX_USE_PORT`. The service processes must directly consume `LYNX_USE_PORT`; A2UI also directly consumes `LYNX_USE_HOST`. Preserve `HOST` and `PORT` as compatibility fallbacks plus each service's existing defaults outside the mesh. UI Judge must still bind both unspecified IPv4 and IPv6 addresses.
