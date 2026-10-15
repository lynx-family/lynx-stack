---
applyTo: "packages/react/runtime/src/**"
---

Cross-thread function handles must retain the reloadVersion of their registered background context, including when first-screen handles hydrate. A ref unmount callback or GC finalizer may run after reloadVersion has increased; reading the current version when sending cannot establish ownership. Return messages must echo the caller's version, and pending calls must track versions individually because Snapshot ordinary reload can preserve the return table. Regression tests should delay actual call, return, and release messages across reload and verify that current callbacks still work.

MainThreadObject factory definitions live in the shared worklet runtime. When a type is registered after reloadVersion changes, replace its definition so resolvedCreate cannot retain the previous entry's module dependencies. Preserve cached factories for duplicate registrations within one reloadVersion, and preserve the branding and identity of already-realized objects.
