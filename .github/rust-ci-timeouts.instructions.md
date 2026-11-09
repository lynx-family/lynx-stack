---
applyTo: ".github/workflows/rust.yml"
---

Keep the all-features Clippy job's time budget aligned with the Rust test job. Cold workspace compilation can exceed ten minutes; verify GitHub job annotations before treating a cancelled job as a source failure, and retain the full lint command when adjusting its timeout.
