---
applyTo: "{start.sh,packages/genui/server/**,packages/genui/ui-judge/**}"
---

Deployment launchers map `REQUIRE_HTTP_MESH=True` to `HOST=127.0.0.1` and require `MESH_INGRESS_PORT` as `PORT`. The service processes must directly consume `HOST` and `PORT`. Preserve direct overrides plus each service's existing defaults outside the mesh. UI Judge opens both unspecified IPv4 and IPv6 listeners for its default `0.0.0.0` host and one listener for a specific host such as the mesh loopback address.
