// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { scriptReuseInstructions } from './script-reuse.js';
import {
  LYNX_XML_STYLE_PRESET_INSTRUCTIONS,
  validateStylePreset,
} from './style-preset.js';
import type { LynxXmlStylePreset } from './style-preset.js';
import {
  VANILLA_LYNX_REUSED_SCRIPT_GUIDANCE,
  VANILLA_LYNX_SKILL_GUIDANCE,
  VANILLA_LYNX_TEMPLATE_REUSED_SCRIPT_GUIDANCE,
} from './vanilla-lynx-skill.js';

/** The default Lynx engine version used by generated XML artifacts. */
export const LYNX_XML_ENGINE_VERSION = '4.2';

/** Options used to customize the Lynx XML generation system prompt. */
export interface BuildLynxXmlSystemPromptOptions {
  /**
   * Generate business callbacks and let the agent assemble shared script logic.
   * @defaultValue false
   * @example { enableScriptReuse: true, enableHtmlFragment: true }
   */
  enableScriptReuse?: boolean;
  /** Generate an intermediate document for deterministic fragment compilation. */
  enableHtmlFragment?: boolean;
  /** Reuse preset utility CSS independently of Template. Disabled when omitted or false. */
  stylePreset?: LynxXmlStylePreset | false;
  /** Override the generated artifact's Lynx engine version. */
  engineVersion?: string;
  /** Append caller-specific instructions after the built-in contract. */
  appendix?: string;
}

const ENGINE_VERSION_PATTERN = /^\d+(?:\.\d+)*$/u;

/** Intermediate source contract for deterministic fragment compilation. */
export const LYNX_XML_HTML_FRAGMENT_INSTRUCTIONS =
  `Template mode is enabled for this request (this output contract overrides the imported document guidance below):
- Generate the entire document in one response: one <template> containing the initial XML element fragment directly inside <lynx>, alongside CSS and one main-thread script in their normal source blocks. Prefer placing the template first, but block order is not significant. Never omit the template, even when conversation history contains already-compiled .lynxml artifacts. The server removes <template> and compiles it to Element PAPI before delivery; it is an intermediate format, not a runtime Lynx element.
- Give a unique id ONLY to nodes referenced later by event binding, state updates, or cleanup. Omit id on purely static nodes; do not assign ids to every node. Use well-formed XML, literal attributes and XML entities in the template. Keep style, script, lynx, and page elements outside the fragment. Prefer literal text directly inside <text>. An explicit <raw-text> leaf may use text content or a text attribute, never both; put styling, event handlers, and update ids on its parent <text>. Do not use interpolation, loops, conditional directives, or inline event-handler attributes; implement dynamic behavior in JavaScript.
- The server supplies createFragment(page, pageId). Call it exactly once in renderPage(), after page and pageId exist: nodes = createFragment(page, pageId). Declare let nodes at main-thread script scope so later event, update, and cleanup handlers can use nodes["cityText"] for id="cityText". Access nodes only after rendering. Do not declare or shadow createFragment, invent nodeN variables, or assume XML ids declare variables.
- createFragment creates and appends the initial roots to page and returns their id-to-node map. Do not recreate or append the initial roots yourself. Bind events and apply initial state after the call. Use Element PAPI for subsequent dynamic updates and new nodes.
- Write all CSS, state, event handlers, lifecycle registration, and cleanup in the same response. Do not request conversion, wait for bindings, or output placeholders. The server performs conversion after generation without another model request.`;

/** Build a system prompt for producing complete, zero-build `.lynxml` files. */
export function buildLynxXmlSystemPrompt(
  options: BuildLynxXmlSystemPromptOptions = {},
): string {
  validateStylePreset(options.stylePreset);
  const engineVersion = normalizeEngineVersion(
    options.engineVersion ?? LYNX_XML_ENGINE_VERSION,
  );
  const prompt = buildBasePrompt(
    engineVersion,
    options.enableHtmlFragment === true,
    options.stylePreset === 'default',
    options.enableScriptReuse === true,
  );
  const appendix = options.appendix?.trim();
  return appendix ? `${prompt}\n\n${appendix}` : prompt;
}

/** Normalize and validate a requested Lynx engine version. */
function normalizeEngineVersion(engineVersion: string): string {
  const normalized = engineVersion.trim();
  if (!ENGINE_VERSION_PATTERN.test(normalized)) {
    throw new TypeError(
      `Invalid Lynx engine version: ${JSON.stringify(engineVersion)}`,
    );
  }
  return normalized;
}

/** Build the provider-neutral Lynx XML prompt for one engine version. */
function buildBasePrompt(
  engineVersion: string,
  enableHtmlFragment: boolean,
  enableStylePreset: boolean,
  enableScriptReuse: boolean,
): string {
  const guidance = enableScriptReuse
    ? (enableHtmlFragment
      ? VANILLA_LYNX_TEMPLATE_REUSED_SCRIPT_GUIDANCE
      : VANILLA_LYNX_REUSED_SCRIPT_GUIDANCE)
    : VANILLA_LYNX_SKILL_GUIDANCE;
  return `
You are the Lynx XML generation agent for Lynx GenUI. Turn the user's request
into ${
    enableHtmlFragment || enableScriptReuse
      ? 'one intermediate document for server assembly'
      : 'one complete, runnable, zero-build .lynxml artifact'
  } implemented with
Vanilla Lynx, Element PAPI, and Lynx Runtime APIs.

The GenUI-specific requirements below override imported guidance wherever they
conflict.

GenUI output requirements:
- Return only the raw artifact. Do not use Markdown fences, explanations, or
  text before or after the document.
- Generate in main-thread-only mode: put all page state, UI logic, and event
  handlers in exactly one <script thread="main"> block. Use only APIs available
  on the main thread.
- Set the <lynx> root's engine-version to "${engineVersion}".
- Add another attribute to the <lynx> root only when the user or consuming
  integration defines the corresponding PageConfig key. Never invent root
  configuration.

${
    enableHtmlFragment
      ? (enableStylePreset
        ? LYNX_XML_HTML_FRAGMENT_INSTRUCTIONS.replace(
          'Write all CSS,',
          'Write only custom CSS beyond the enabled preset,',
        )
        : LYNX_XML_HTML_FRAGMENT_INSTRUCTIONS).split('\n').filter(line =>
          !enableScriptReuse
          || (!line.startsWith('- The server supplies createFragment')
            && !line.startsWith('- createFragment creates')
            && !line.startsWith('- Write all CSS,')
            && !line.startsWith('- Write only custom CSS'))
        ).join('\n') + '\n\n'
      : ''
  }${guidance}

${enableScriptReuse ? scriptReuseInstructions(enableHtmlFragment) : ''}

${
    enableStylePreset
      ? LYNX_XML_STYLE_PRESET_INSTRUCTIONS + '\n\n'
      : ''
  }${
    buildAdaptationContract(
      enableHtmlFragment,
      enableStylePreset,
      enableScriptReuse,
    )
  }

Artifact boundaries:
- Keep all code in the document: no imports, package dependencies, eval,
  Function, fetchBundle, loadScript, analytics, or tracking.
- Use only asset/link URLs supplied by the user or host, or returned by enabled
  search/image tools. Never invent URLs or execute external scripts.
- Keep runtime behavior local to the page; do not issue scripted network requests.
- Do not claim device testing.
`.trim();
}

/** Match local constraints to the tree, script, and style authoring modes. */
function buildAdaptationContract(
  enableHtmlFragment: boolean,
  enableStylePreset: boolean,
  enableScriptReuse: boolean,
): string {
  const page = enableScriptReuse ? 'ctx.page' : 'page';
  const pageId = enableScriptReuse ? 'ctx.pageId' : 'pageId';
  const layoutClasses = enableStylePreset
    ? 'preset flex with flex-row or flex-col'
    : 'classes declaring display: flex and flex-direction: row or column';
  const layoutTargets = enableScriptReuse
    ? 'every business container'
    : 'the Page and every container';

  // Template and ScriptReuse already define node maps and initial-tree ownership.
  // Keep only local constraints here, preserving their mode-specific vocabulary.
  return [
    'Lynx XML adaptation contract:',
    enableHtmlFragment && enableScriptReuse
      ? `- During dynamic updates, ctx.append and ctx.replaceChildren take nodes,
  never ids. Use ctx creation helpers rather than raw Element PAPI.`
      : `- ${
        enableHtmlFragment ? 'During dynamic updates, ' : ''
      }__AppendElement and append helpers take nodes, never ids.
  In Element PAPI, pass ${pageId} only as the first argument to page-owned creation APIs.`,
    `- Pass ${
      enableScriptReuse ? 'ctx, ' : ''
    }parent nodes and local dependencies to helpers; call/apply/bind
  cannot expose caller locals. Declare shared state and node references in scope
  for all render, event, update, and cleanup handlers; initialize before use.`,
    `- Validate ${
      enableScriptReuse
        ? 'business fields in hook data/patch'
        : 'lifecycle payloads'
    } and app-event payloads;
  default missing values.`,
    `- Use ${layoutClasses}
  on ${layoutTargets} that lays out Element children; no inline or implicit layout.
  Leaf text and images are exempt.`,
    enableScriptReuse
      ? `- Keep ctx.page's genui-page class; only add an optional responsive root font size.
  Its first business child owns sizing, background, and layout.`
      : `- Page only gets its layout class and optional responsive root font size;
  its first business child owns sizing, background, and layout.`,
    `- Default to a vertical scroll view, including when content height is uncertain.
  Use a non-scrolling root only when the user explicitly requests a fixed
  single-screen layout; fitting one viewport alone is not an exception.`,
    enableHtmlFragment
      ? `- Make <scroll-view scroll-orientation="vertical"> the first <template> root;
  use <view> there only for the explicit fixed single-screen exception. Roots
  become direct Page children; never wrap the scroll view in a business <view>.`
      : `- Append __CreateScrollView(${pageId}) as ${page}'s first business child and set
  scroll-orientation to "vertical" via __SetAttribute. Use __CreateView(${pageId})
  there only for the explicit fixed single-screen exception. Never wrap the
  scroll view in a business view.`,
    enableStylePreset
      ? '- Scroll-view classes: preset flex flex-col w-full h-screen.'
      : `- Scroll-view class: display: flex, flex-direction: column,
  width: 100%, and a definite height such as 100vh.`,
    `- Scroll content: direct sections or one growing wrapper without 100vh; no nested
  vertical scroll views. Fixed bars are ${
      enableHtmlFragment
        ? 'sibling <template> roots'
        : 'direct Page children beside the scroll view'
    };
  reserve their full size plus host-supplied safe-area insets once in scrolling content.`,
    `- calc() is for lengths only. No min()/max()/clamp(), physical units, vmin or vmax.
  Prevent fixed-size shrinking with ${
      enableStylePreset ? 'preset shrink-0' : 'flex-shrink: 0'
    } or an explicit minimum size.`,
  ].join('\n');
}

/** The default Lynx XML generation system prompt. */
export const LYNX_XML_SYSTEM_PROMPT: string = buildLynxXmlSystemPrompt();

/** The Lynx XML prompt for one-pass fragment generation. */
export const LYNX_XML_HTML_FRAGMENT_SYSTEM_PROMPT: string =
  buildLynxXmlSystemPrompt({
    enableHtmlFragment: true,
  });
