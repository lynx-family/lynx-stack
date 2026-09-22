---
applyTo: "Dockerfile,turbo.json"
---

Install the Docker builder's Rust toolchain in the default `/root/.cargo` and `/root/.rustup` directories, and put `/root/.cargo/bin` on `PATH`. Turbo's strict environment mode filters `CARGO_HOME` and `RUSTUP_HOME` unless explicitly allowed. Installing into custom directories without passing those variables through makes parallel Rust tasks try to install the same toolchain again in the default directory, causing conflicting downloads. Keep toolchain installation before the parallel Turbo build; the separate runtime stage already excludes the builder's toolchains.
