// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** Mobile-first visual and interaction defaults for generated Lynx XML. */
export const LYNX_XML_MOBILE_DESIGN_GUIDANCE: string = `
Mobile design contract:
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
- For full-screen surfaces, consume env(safe-area-inset-top),
  env(safe-area-inset-right), env(safe-area-inset-bottom), and
  env(safe-area-inset-left) exactly once per exposed edge. Apply safe-area
  padding on the outer shell or corresponding fixed bar, then put ordinary
  visual padding on an inner content wrapper so neither spacing is lost or
  doubled. When a bottom bar or action is fixed, scrolling content must reserve
  the bar's full height and bottom inset so its final content remains visible.
- Use a viewport-derived root font size such as
  font-size: calc(100vw / 23.4375) and express the reusable spacing and type
  scale with rem. Use %, vw, and vh where they describe available space. Never
  hardcode the whole interface to a 375px canvas or scale the screen with a
  transform.
- Define a small semantic token set with CSS variables for canvas, surface,
  primary and secondary text, border, accent, spacing, and corner radii. Reuse
  those tokens consistently instead of introducing unrelated colors, gaps, or
  radii for each component.
- At a 375px reference width, default to roughly 16px to 20px responsive
  horizontal gutters, 16px to 24px between sections, and 12px to 16px of card
  or control padding. Build those values from a consistent 4px or 8px rhythm
  and let them scale responsively. Edge-to-edge content should be intentional,
  normally limited to media or full-width background surfaces.
- Prefer a single-column reading flow with full-width sections inside the
  content gutters. Use wrapping rows sparingly for short, comparable items that
  remain readable on a 320px screen. Do not squeeze primary content into tiny
  columns merely to fill space.
- Keep typography compact and legible: use no more than three or four clearly
  differentiated sizes, explicit line heights, and a restrained weight scale.
  Body copy should be roughly 14px to 16px at the reference width, supporting
  text roughly 12px to 14px, and screen titles roughly 20px to 28px. Let body
  content wrap with white-space: normal; reserve nowrap and ellipsis for short,
  genuinely single-line labels.
- Give every tappable control a touch box of at least 44px by 44px, sufficient
  separation from adjacent controls, an aria-label, and visible pressed,
  selected, disabled, and loading feedback when those states apply. Never make
  hover the only indication of interactivity. Prefer an easy-to-reach,
  full-width primary action when the screen has one dominant next step.
- Create hierarchy with spacing, typography, surface color, and subtle borders.
  Use cards only for meaningful grouping; avoid card-inside-card layouts,
  turning every label into a pill, excessive corner radii, and decorative
  gradients or dividers that compete with the content. Use one accent color for
  primary actions and selection, and keep text contrast clearly readable.
- Give bitmap media a deliberate aspect ratio. Set image mode to aspectFit when
  all content must remain visible or aspectFill when intentional cropping is
  acceptable, and protect the image from Flex compression. Avoid stretched
  images and oversized decorative regions that push primary content or actions
  below the initial viewport without a clear product reason.
- Treat these as defaults. An explicit user-supplied design system, target
  viewport, orientation, density, or immersive edge-to-edge requirement may
  replace the visual defaults. Immersive backgrounds may extend under system
  insets, but important content and controls must remain inside the safe area;
  Lynx runtime, explicit layout, and accessibility requirements still apply.
`.trim();
