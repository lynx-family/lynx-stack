---
applyTo: ".github/workflows/**/*.yml"
---

Keep `hashFiles` globs rooted at the repository directories they need, such as `packages/**/src/**/*.rs`, instead of starting with `**/`; broad leading globs can time out on Windows runners after dependencies and build outputs are present.
