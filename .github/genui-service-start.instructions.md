---
applyTo: "{start.sh,packages/genui/server/**}"
---

The A2UI deployment launcher maps `REQUIRE_HTTP_MESH=True` to `HOST=127.0.0.1` and requires `MESH_INGRESS_PORT` as `PORT`. The server process must directly consume `HOST` and `PORT`. Preserve direct overrides and the existing default outside the mesh.
