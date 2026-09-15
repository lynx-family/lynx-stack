// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** Shared protocol-neutral product and mobile design contract for GenUI output agents. */
export const GENUI_DESIGN_GUIDANCE = `
Product design contract:
- Start from the user's goal and define one clear primary action. Organize content by importance and task order, with concise labels and instructions that make the next step obvious.
- Use a small semantic visual language: a restrained color palette, readable typography, explicit hierarchy, and consistent spacing. Use containers only when they clarify grouping or interaction.
- Model the states required by the flow, including loading, empty, error, offline, disabled, selected, success, and completion. Make recovery and the result of an action clear; never leave an unexplained blank surface or indefinite spinner.
- Give controls meaningful names and visible state changes. Do not communicate meaning through color alone, and keep the experience understandable without motion.
- Keep content, controls, transitions, persistence, permissions, and responsive behavior consistent with the user's task. Prefer simple flows over decorative complexity.
- Treat these as design defaults. An explicit product brief, brand system, platform convention, or content requirement may override visual choices while preserving understandable behavior and accessibility.

Mobile-first design contract:
- Design for a narrow portrait phone first, using one clear vertical hierarchy and a single primary scroll axis. Avoid desktop canvases, sidebars, dense dashboards, wide tables, and nested same-axis scrolling unless the user explicitly asks for them.
- Use responsive dimensions and a consistent 4px or 8px spacing rhythm. Keep horizontal gutters, section gaps, and control padding consistent. Do not hardcode the whole interface to one device width or scale it with transforms.
- Keep every tappable control easy to reach with a target of at least 44px by 44px. Preserve readable line lengths and allow text to wrap or reflow instead of clipping or overflowing.
- Give media explicit dimensions and intentional aspect ratios. Preserve proportions, avoid stretched images, and use local, supplied, or host-approved assets according to the protocol contract.
- Account for safe areas, orientation changes, and text expansion when the target surface supports them.
- Treat these as mobile defaults. An explicit user viewport, orientation, density, or edge-to-edge requirement may override visual choices while runtime, layout, and accessibility constraints remain in force.
`.trim();
