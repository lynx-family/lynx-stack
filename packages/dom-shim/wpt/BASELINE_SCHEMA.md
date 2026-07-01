# `baseline.json` Schema

> The committed `baseline.json` records the latest known good WPT subset
> result for `@lynx-js/dom-shim`. CI (US-464) compares each PR's run
> against this file. See Shim_Implementation_PRD.md US-463.

## Top-level

```jsonc
interface BaselineFile {
  schemaVersion: '1';
  startedAt: string;       // ISO timestamp of the run start
  finishedAt: string;      // ISO timestamp of the run finish
  totalTests: number;      // sum across all directories
  passed: number;
  failed: number;
  errored: number;
  skipped: number;
  overallPassRate: number; // passed / totalTests (0..1)
  gateThreshold: number;   // from subset.json (default 0.70 per US-465)
  directories: DirectoryResult[];
}
```

## DirectoryResult

```jsonc
interface DirectoryResult {
  path: string;            // e.g. 'dom/nodes/read'
  passed: number;
  failed: number;
  errored: number;
  skipped: number;
  passRate: number;        // passed / total in this directory
  tests: TestResult[];
}
```

## TestResult

```jsonc
interface TestResult {
  directory: string;
  name: string;
  status: 'pass' | 'fail' | 'error' | 'skip';
  message?: string;        // assertion message / skip reason / error toString
  diagnostics: string[];   // shim:Lx/... codes recorded during the test
}
```

## Regenerating

```sh
pnpm -F @lynx-js/dom-shim wpt-update-baseline
```

This re-runs the subset against the current Shim and overwrites
`baseline.json`. The CI gate (US-464) fails PRs where the new run's
overall or per-directory pass rate drops more than 0.5% below the
baseline.

## Reading

Tools (CI checks, the dashboard from US-466/467) treat `baseline.json`
as truth. A drop is investigated as a regression; an intentional
improvement re-baselines via the script above.
