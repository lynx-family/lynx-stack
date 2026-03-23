---
applyTo: "packages/**/package.json"
---

For non-private packages published from this repository, include `repository.type`, `repository.url`, and `repository.directory` pointing to `lynx-family/lynx-stack`. Missing or empty `repository` metadata can cause npm provenance validation failures during publish, including canary releases.
