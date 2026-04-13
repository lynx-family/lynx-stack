---
applyTo: ".github/skills/pr-ci-watch-subagent/**/*"
---

When maintaining the PR CI watch skill, keep the workflow centered on a subagent that waits on `gh pr checks <pr> --watch` and only returns once CI reaches a terminal success or failure state.
