---
applyTo: "examples/react-externals-web/**,.github/workflows/relative-ci.yml,.github/workflows/workflow-bundle-analysis.yml"
---

Keep the React Externals Web example in both the bundle-analysis build matrix and the RelativeCI upload matrix, with matching artifact names. Generate its stats from the web-only consumer compilation after the external bundles are emitted, so `main.web.bundle`, `comp-lib.web.bundle`, and `react.web.bundle` all contribute to the report. Verify the emitted asset sizes against the actual files; measuring only JavaScript modules misses encoded CSS sections inside the external bundles.
