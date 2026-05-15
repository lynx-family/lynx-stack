---
applyTo: ".github/actions/comment-ui-judge-result/**/*,.github/workflows/ui-judge*.yml,.github/scripts/*ui-judge*.mjs"
---

Keep UI Judge PR commenting split across two trust domains: the pull_request workflow may check out and execute PR code, but should keep read-only permissions and only upload a JSON result artifact; the workflow_run commenter may write a PR comment, but must use the default-branch workflow/script and must not execute code from the PR head.
