---
applyTo: ".github/workflows/**"
---

Self-hosted Ubuntu runner labels use the `lynx-ubuntu-<ubuntu-version>-<capacity>` pattern, for example `lynx-ubuntu-26.04-medium` and `lynx-ubuntu-26.04-xlarge`. When changing these labels, update matching matrix label comparisons and comments in the workflow files. For GitHub-hosted Ubuntu runners, prefer explicit labels such as `ubuntu-26.04` over `ubuntu-latest` when workflows should stay on a specific OS release.
