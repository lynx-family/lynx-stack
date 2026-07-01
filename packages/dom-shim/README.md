# @lynx-js/dom-shim

> **Status:** Experimental / Phase 1 benchmark only.

This package is the home of the **Phase 1 LLM-output validation benchmark** for the proposed Lynx DOM Shim. It is not (yet) the DOM Shim itself.

The goal of Phase 1 is to produce hard data comparing three LLM-output routes — raw Element PAPI direct output, DOM Shim, and A2UI JSON DSL — across four metrics (one-shot parse rate, one-shot render rate, N-round convergence rate, visual similarity to intent). The benchmark output justifies (or kills) the Shim implementation path before any production code is written.

See `PRD.md` at the worktree root for the full multi-phase plan.

A related but distinct DOM Shim implementation lives under `packages/testing-library/testing-environment/src/dom-shim/` on branch `Huxpro/lynx-dom-shim`, targeting the testing environment use case.
