---
applyTo: "packages/**/package.json"
---

For non-private packages published from this repository, include `repository.type`, `repository.url`, and `repository.directory` pointing to `lynx-family/lynx-stack`. Missing or empty `repository` metadata can cause npm provenance validation failures during publish, including canary releases.

When a package publishes directories that contain nested workspace projects, exclude `!**/node_modules/**` in its `files` allowlist. pnpm 12.7 and later preserve symlinks whose targets remain inside the package, but the npm registry rejects tarballs containing those symlinks.
