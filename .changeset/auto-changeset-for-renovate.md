---

---

ci(renovate): auto-generate a changeset for dependency bumps

Renovate now runs `.github/scripts/generate-renovate-changeset.cjs` as a
`postUpgradeTasks` command. After it rewrites the dependency files on a branch,
the script writes a changeset that `patch`-bumps every publishable workspace
package whose `dependencies`/`peerDependencies` changed, so the bump satisfies
`check-dep-changes-have-changeset` and ships in the next release.
devDependency-only bumps produce no changeset. No package changes here — empty
changeset.
