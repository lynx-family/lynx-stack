---
applyTo: ".github/workflows/**"
---

Self-hosted Ubuntu runner labels use the `lynx-ubuntu-<ubuntu-version>-<capacity>` pattern, for example `lynx-ubuntu-26.04-medium` and `lynx-ubuntu-26.04-xlarge`. When changing these labels, update matching matrix label comparisons and comments in the workflow files. Treat GitHub-hosted labels such as `ubuntu-latest` as a separate runner family unless the change explicitly targets hosted runners.
