---
applyTo: ".github/workflows/**/*.yml"
---

Keep `hashFiles` globs rooted at the repository directories they need, such as `packages/**/src/**/*.rs`, instead of starting with `**/`; broad leading globs can time out on Windows runners after dependencies and build outputs are present.
When a workflow-test job restores the strict `.turbo` cache by `runner.os`, make it depend only on the matching OS build job. Linux-only tests should not wait for Windows build cache priming.
Keep the reusable build workflow single-runner; callers that need multiple operating systems should own the matrix and pass the selected runner label into the reusable workflow.
