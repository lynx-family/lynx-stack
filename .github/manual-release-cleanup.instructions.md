---
applyTo: "{packages/**/package.json,.changeset/**}"
---

When a package has already been published manually outside the Changesets GitHub Action, keep the package version aligned with the published npm version and delete the changeset files that were consumed by that manual release. Do not leave those changesets in the tree, because the next automated release will treat them as new changes and bump the package again. A GitHub Release entry also requires a corresponding tag/release to be created separately; deleting changesets in a follow-up PR will not backfill a GitHub Release.
