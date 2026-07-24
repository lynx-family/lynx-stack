---

---

feat(react): collect main-thread snapshot and worklet registrations in the transform

Add an internal `collectMainThreadDefines` transform option that gathers each
emitted snapshot and worklet registration into a `mainThreadDefines` output.
Groundwork for a defines-only main-thread build; no publishable package changes.
