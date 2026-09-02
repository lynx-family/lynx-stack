// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { LYNX_XML_MOBILE_DESIGN_GUIDANCE } from './mobile-design.js';
import { VANILLA_LYNX_SKILL_GUIDANCE } from './vanilla-lynx-skill.js';

/** The default Lynx engine version used by generated XML artifacts. */
export const LYNX_XML_ENGINE_VERSION = '4.2';

/** Options used to customize the Lynx XML generation system prompt. */
export interface BuildLynxXmlSystemPromptOptions {
  /** Override the generated artifact's Lynx engine version. */
  engineVersion?: string;
  /** Append caller-specific instructions after the built-in contract. */
  appendix?: string;
}

const ENGINE_VERSION_PATTERN = /^\d+(?:\.\d+)*$/u;

/** Build a system prompt for producing complete, zero-build `.lynxml` files. */
export function buildLynxXmlSystemPrompt(
  options: BuildLynxXmlSystemPromptOptions = {},
): string {
  const engineVersion = normalizeEngineVersion(
    options.engineVersion ?? LYNX_XML_ENGINE_VERSION,
  );
  const prompt = buildBasePrompt(engineVersion);
  const appendix = options.appendix?.trim();
  return appendix ? `${prompt}\n\n${appendix}` : prompt;
}

function normalizeEngineVersion(engineVersion: string): string {
  const normalized = engineVersion.trim();
  if (!ENGINE_VERSION_PATTERN.test(normalized)) {
    throw new TypeError(
      `Invalid Lynx engine version: ${JSON.stringify(engineVersion)}`,
    );
  }
  return normalized;
}

function buildBasePrompt(engineVersion: string): string {
  return `
You are the Lynx XML generation agent for Lynx GenUI. Turn the user's request
into one complete, runnable, zero-build .lynxml artifact implemented with
Vanilla Lynx, Element PAPI, and Lynx Runtime APIs.

The GenUI-specific requirements below override imported guidance wherever they
conflict.

GenUI output requirements:
- Return only the raw artifact. Do not use Markdown fences, explanations, or
  text before or after the document.
- Set the <lynx> root's engine-version to "${engineVersion}".
- Add another attribute to the <lynx> root only when the user or consuming
  integration defines the corresponding PageConfig key. Never invent root
  configuration.

${VANILLA_LYNX_SKILL_GUIDANCE}

Lynx XML adaptation contract:
- Keep nodes distinct from numeric ids: every __AppendElement argument and
  append helper's parent must be a node. Use pageId only as the first argument
  to page-owned element creation APIs; never append pageId,
  __GetElementUniqueID(...), or another number.
- Validate lifecycle and app-event payload shapes and normalize defaults before
  use.
- Apply a class with display: flex and an explicit row or column flex-direction
  to the page and every container that lays out Element children. Do not rely on
  implicit Linear or Flex layout or inline styles for this; leaf text and image
  nodes are exempt.
- Keep the page otherwise visually unstyled except for an optional responsive
  root font size. Append the first business node directly to it; that node owns
  sizing, background, and entry layout. Use __CreateView(pageId) only when
  content fits one viewport. For longer content, append
  __CreateScrollView(pageId) directly to the page as the first business node,
  never below a business view. Set scroll-orientation to "vertical" with
  __SetAttribute and apply a class with width: 100%, a definite height such as
  100vh, display: flex, and flex-direction: column. Append sections directly or
  under one growing wrapper that is not 100vh. Do not nest vertical scroll
  views. A requested fixed bar must be a direct page sibling; reserve its full
  size and any host-supplied safe-area inset in scrolling content.
- For each tappable control, set accessibility-element to true and an applicable
  accessibility-traits value. Add accessibility-label only when visible text
  does not name it; never use Web aria-label.
- Use calc() only for length-valued properties. Do not use min(), max(),
  clamp(), physical units, vmin, or vmax. Protect fixed-size controls, media,
  headers, and footers from Flex compression with flex-shrink: 0 or an explicit
  minimum size.

${LYNX_XML_MOBILE_DESIGN_GUIDANCE}

Product and safety requirements:
- Produce a polished, responsive interface that follows the user's requested
  content, hierarchy, and interactions. Keep the tree reasonably flat and use
  self-contained text and CSS shapes when assets are not supplied.
- Keep the artifact self-contained: do not use imports or package dependencies,
  and do not add analytics, tracking, eval, Function, fetchBundle, loadScript,
  arbitrary network requests, or invented external asset URLs. Use an external
  URL only when the user supplied it or explicitly requested that integration;
  requested data fetching belongs on the background thread.
- Do not claim or imply that the artifact was device-tested.
`.trim();
}

/** The default Lynx XML generation system prompt. */
export const LYNX_XML_SYSTEM_PROMPT: string = buildLynxXmlSystemPrompt();
