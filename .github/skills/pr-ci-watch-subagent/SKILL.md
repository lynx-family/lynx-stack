---
name: pr-ci-watch-subagent
description: Use this skill whenever you have just created a GitHub pull request with `gh pr create`, or the user asks you to monitor PR CI / checks / workflows until they finish. This skill teaches you to launch a subagent that uses the GitHub CLI watch capability to wait for CI completion and report a final pass/fail result back to the main agent instead of polling manually.
---

# PR CI Watch Subagent

Use this skill immediately after creating a GitHub pull request when CI status matters.
The goal is to keep the main agent free while a subagent waits on GitHub checks.

## When to use

Use this skill when any of these are true:

- You just ran `gh pr create` and need to know whether CI passes.
- The user asks you to watch PR checks, CI, workflows, or GitHub status until completion.
- You need a blocking wait for GitHub checks but do not want the main agent to idle.

## Core behavior

1. Capture the PR identifier right after PR creation.
2. Start a subagent dedicated to CI monitoring.
3. In that subagent, use `gh` watch-style behavior to wait for the PR checks to finish.
4. Return control to the main agent only when CI reaches a terminal state:
   - success / all required checks passed
   - failure / any check failed
5. Report a concise final summary that includes the PR reference and the terminal CI outcome.

## Implementation pattern

### Main agent

After `gh pr create`, obtain one of the following:

- PR URL
- PR number
- current branch when it unambiguously maps to the PR

Then launch a subagent with a prompt like:

```text
Monitor GitHub PR CI until completion.

Inputs:
- PR: <url-or-number>
- Repository root: <repo-path>

Requirements:
- Use the GitHub CLI.
- Prefer the built-in watch behavior rather than manual polling.
- Wait until checks reach a terminal state.
- Return only after CI succeeds or fails.
- Final response must state whether CI passed or failed and include any failing check names if available.
```

### Subagent

The subagent should:

1. Resolve the PR reference if needed.
2. Run a GitHub CLI command that blocks until checks complete.
3. Inspect the final status.
4. Return a short result to the main agent.

Preferred command pattern:

```bash
gh pr checks <pr> --watch
```

If the CLI output supports the exit code semantics in the current environment, use them to determine success vs failure. If not, read the final output carefully and summarize the terminal state.

## Reporting contract

The subagent's final message should use this structure:

```text
PR: <pr-url-or-number>
CI result: passed|failed
Summary: <one sentence>
Failed checks: <comma-separated names or "none">
```

Keep the result brief. The main agent can expand on it for the user if needed.

## Important notes

- Prefer `gh pr checks <pr> --watch` over ad hoc sleep loops because it is simpler and better aligned with GitHub CLI behavior.
- Do not claim CI passed until the watch command reaches a terminal state.
- If authentication or repository resolution fails, return that error clearly instead of guessing.
- If the PR has no checks, report that explicitly so the main agent can decide whether that is acceptable.

## Example main-agent flow

1. Create PR with `gh pr create`.
2. Extract the returned PR URL.
3. Launch the CI-watch subagent with that URL.
4. Wait for the subagent result.
5. Tell the user whether CI passed or failed.
