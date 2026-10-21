---
applyTo: ".github/workflows/workflow-bundle-analysis.yml"
---

For RelativeCI bundle analysis artifacts, preserve the artifact name and the `webpack-stats.json` filename expected by the consumer. Upload with the repository's SHA-pinned `actions/upload-artifact`; the RelativeCI composite action references an unpinned nested action and is rejected by repository policy.
