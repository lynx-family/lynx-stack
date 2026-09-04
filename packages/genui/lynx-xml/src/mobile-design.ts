// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** Provider-neutral mobile design intent adapted to Lynx XML constraints. */
export const LYNX_XML_MOBILE_DESIGN_GUIDANCE: string = `
Mobile design contract:

Viewport and structure:
- Treat a narrow portrait viewport from 320px to 430px as the default target
  unless the user specifies another form factor. Start mobile-first with one
  clear vertical hierarchy. Do not default to a centered desktop canvas,
  sidebar, dense dashboard, wide table, or multi-column application shell.
- For a full-screen artifact, make the first business surface fill the host
  viewport with width: 100% and a definite height such as 100vh. The root
  represents the native host surface, so do not try to size it. For an
  explicitly embedded artifact, fill the available host bounds instead.
- When content is expected to exceed, or can reasonably exceed, one viewport,
  use one outer page-level vertical scrolling surface. Keep one primary
  vertical scroll axis, do not nest same-axis scrolling regions, and do not
  allow screen-level horizontal overflow. Use horizontal scrolling only when
  the requested interaction is inherently horizontal, such as a carousel.
  Add a persistent fixed header or footer only when the user explicitly
  requests it, and reserve its occupied space in the scrolling content.
- For full-screen surfaces, use safe-area inset values only when the host or
  initialization data explicitly supplies them. Convert each supplied inset to
  a Lynx-supported length and consume it exactly once per exposed edge. Never
  derive safe-area insets from Web CSS environment variables or invent an
  inset when none is supplied.
  Apply safe-area padding on the outer shell or corresponding fixed bar, then
  put ordinary visual padding on an inner content wrapper so neither spacing is
  lost or doubled. When a bottom bar or action is fixed, scrolling content must
  reserve the bar's full height and supplied bottom inset so its final content
  remains visible.

Responsive scale and spacing:
- Use a viewport-derived root font size such as
  font-size: calc(100vw / 23.4375) and express the reusable spacing and type
  scale with rem. Use %, vw, and vh where they describe available space. Never
  hardcode the whole interface to a 375px canvas or scale the screen with a
  transform.
- At a 375px reference width, default to roughly 16px to 20px responsive
  horizontal gutters, 16px to 24px between sections, and 12px to 16px of card
  or control padding. Build those values from a consistent 4px or 8px rhythm
  and let them scale responsively. Edge-to-edge content should be intentional,
  normally limited to media or full-width background surfaces.
- Prefer a single-column reading flow with full-width sections inside the
  content gutters. Use wrapping rows sparingly for short, comparable items that
  remain readable on a 320px screen. Do not squeeze primary content into tiny
  columns merely to fill space.

Visual hierarchy, typography, and color:
- Keep a small semantic palette for canvas, surface, primary and secondary
  text, border, accent, spacing, and corner radii. Resolve it into reusable
  class declarations with Lynx-supported literal values instead of introducing
  unrelated colors, gaps, or radii for each component.
- Keep typography compact and legible: use no more than three or four clearly
  differentiated sizes, explicit line heights, and a restrained weight scale.
  Body copy should be roughly 14px to 16px at the reference width, supporting
  text roughly 12px to 14px, and screen titles roughly 20px to 28px. Let body
  content wrap with white-space: normal; reserve nowrap and ellipsis for short,
  genuinely single-line labels.
- Create hierarchy with spacing, typography, surface color, and subtle borders.
  Use cards only for meaningful grouping; avoid card-inside-card layouts,
  turning every label into a pill, excessive corner radii, and decorative
  gradients or dividers that compete with the content. Use one accent color for
  primary actions and selection, and keep text and control contrast clearly
  readable. Never rely on color alone to communicate status, selection, errors,
  or other meaning; pair it with text, shape, or an icon.

Interaction, forms, and state:
- Give every tappable control a touch box of at least 44px by 44px, sufficient
  separation from adjacent controls, an accessible name and matching control
  semantics, and visible pressed, selected, disabled, and loading feedback when
  those states apply. Do not depend on hover feedback. Prefer an easy-to-reach,
  full-width primary action when the screen has one dominant next step, and do
  not give multiple actions equal visual priority without a product reason.
- Give every input a persistent visible label or instruction; placeholder text
  is supplementary and must not be the only label. Place concise, actionable
  validation feedback next to the affected field, reserve enough space to avoid
  disruptive layout jumps, preserve the user's entered value, and make the
  recovery action clear.
- Design loading, empty, error, offline, success, disabled, and selected states
  when they can occur. Preserve useful context, explain what happened in plain
  language, and expose a clear next action instead of leaving a blank surface or
  relying on an indeterminate spinner indefinitely.

Media and motion:
- Give every bitmap media box explicit width and height chosen for an
  intentional aspect ratio. Preserve intrinsic proportions: keep all content
  visible when required and crop only when intentional. Protect media from Flex
  compression, and avoid stretched images or oversized decorative regions that
  push primary content or actions below the initial viewport without a clear
  product reason.
- Use motion only to explain a transition, hierarchy change, or direct response
  to an interaction. Keep it brief and avoid large, continuous, or decorative
  motion that competes with the task. Meaning and state must remain clear in a
  static presentation; when the host or user requests reduced motion, provide a
  minimal or immediate alternative.

Override boundary:
- Treat these as defaults. An explicit user-supplied design system, target
  viewport, orientation, density, or immersive edge-to-edge requirement may
  replace the visual defaults. Immersive backgrounds may extend under system
  insets, but important content and controls must remain inside the safe area;
  Lynx runtime, explicit layout, and accessibility requirements still apply.
`.trim();
