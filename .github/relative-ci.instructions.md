---
applyTo: ".github/workflows/{workflow-bundle-analysis,relative-ci}.yml"
---

The repository requires full commit SHA pins for Actions, including actions referenced inside third-party composite actions. Avoid `relative-ci/agent-upload-artifact-action@v2`, whose composite action references `actions/upload-artifact@v4` by tag. Prepare the artifact locally and upload it with a SHA-pinned `actions/upload-artifact` instead. Preserve each project's `<project-name>-relative-ci-artifacts` artifact name and place `webpack-stats.json` at the archive root so the `workflow_run` RelativeCI consumer can read it.
