---
applyTo: "docs/**"
---

Keep `docs/doc_build/**` out of the documentation build's Turbo cache because
the static site is large and is not published. The cached build must retain the
generated API pages, navigation, manifest and translations. Use a forced Turbo
build when fresh static output is required.
