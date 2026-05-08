---

---

No package release is required yet. This PR wires the FetchBundle-based
lazy bundle loader path (customSections-based output, JsBytecode encoded
MTS, single CSS section, version-gated default fetcher) behind an
opt-in env var fallback. The feature is incomplete pending downstream
work (engineVersion ≥ 3.8 host availability, @lynx-js/types release with
fetchBundle / loadScript declarations) and will continue to evolve. A
release changeset should be added once the FetchBundle path ships as a
coherent user-visible change.
