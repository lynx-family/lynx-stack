---
applyTo: "{skiplist.json,vitest.shared.ts,README.md,package.json}"
---

When updating skiplist categories, always run each selected group in both projects (`preact-upstream` and `preact-upstream-compiled`) with `SKIPLIST_ONLY=<category>:<index>` before moving entries.
Keep mode orthogonality explicit: shared failures stay in `skip_list`/`permanent_skip_list`, no-compile-only failures go to `nocompile_skip_list`, compiled-only failures go to `compiler_skip_list`.
Because skip matching is title-based, check for duplicate test titles across files before removing an entry; a single title may map to multiple test cases with different outcomes.
In README positioning and run-order guidance, treat compiled mode as the primary product-path confidence signal and describe no-compile mode as a runtime baseline/regression-isolation tool.
