// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

export interface BuildLynxXmlSystemPromptOptions {
  appendix?: string;
}

const require = createRequire(import.meta.url);
const resolvePackage = Reflect.get(require, 'resolve') as (
  packageId: string,
) => string;
// const LYNX_XML_PACKAGE_ROOT = path.dirname(
//   resolvePackage('@lynx-js/genui-lynx-xml/package.json'),
// );
const VANILLA_LYNX_SKILL_PACKAGE_JSON = resolvePackage(
  '@lynx-js/skill-vanilla-lynx/package.json',
);
const VANILLA_LYNX_SKILL_ROOT = path.dirname(
  VANILLA_LYNX_SKILL_PACKAGE_JSON,
);
const VANILLA_LYNX_SKILL_FILES = [
  'SKILL.md',
  'references/main-thread.md',
  'references/event.md',
  'references/background.md',
] as const;

let cachedVanillaLynxSkill: string | undefined;

const LYNX_CSS_RULES = `# Lynx CSS rules

These rules are derived from @byted-lynx/lynx-api-docs:
- skills/using-lynx-api-docs/lynx-vs-web/unsupported-features.md
- skills/using-lynx-api-docs/lynx-vs-web/css-differences.md

Lynx is not a browser. Apply these rules literally instead of assuming Web CSS behavior.

## Layout and display

- Prefer display:flex for flexible row or column layouts. display:linear and display:relative are Lynx-specific alternatives.
- Do not emit display:block, display:inline, display:inline-block, display:table, display:list-item, display:run-in, or display:contents. Use Flex/Linear containers and Element PAPI text nodes instead.
- Do not use float or clear. Recreate those layouts with Flex.
- Do not emit position:static. Lynx defaults to relative positioning.
- z-index only works reliably with position:relative, absolute, fixed, or sticky.
- A z-index child inside a scrollable container may be promoted to a separate compositing layer and fail to follow scrolling. Give the relevant scroll parent position:relative and z-index:0 so parent and child share a stacking context.

## Box model and spacing

- Lynx defaults box-sizing to auto, which commonly behaves like border-box. Set box-sizing:border-box explicitly wherever exact sizing matters.
- Lynx does not collapse adjacent vertical margins. Account for the full sum of both margins.

## Text

- Visible text must be rendered through __CreateText plus __CreateRawText; a view cannot contain a bare string.
- Lynx text defaults to no wrapping. Set white-space:normal when wrapping is required; otherwise use white-space:nowrap. Do not use pre, pre-wrap, pre-line, or break-spaces.
- Do not use generated content, quotes, counters, list-style properties, text-transform, word-spacing, word-break, word-wrap, overflow-wrap, hyphens, tab-size, writing-mode, text-orientation, direction, or unicode-bidi.
- text-overflow supports clip and ellipsis, not fade. Treat vertical-align, text-indent, letter-spacing, and user-select as partial support and avoid them when a simpler layout works.

## Selectors

- Prefer class selectors.
- The only supported pseudo selectors in this protocol are :not(), :hover, :active, :focus, :root, ::placeholder, and ::selection.
- Never use structural pseudo-classes such as :nth-child(), :nth-of-type(), :first-child, :last-child, :only-child, :first-of-type, :last-of-type, :only-of-type, or :empty. They parse but never match.
- Never use :is(), :where(), :has(), :lang(), :dir(), :link, :visited, :checked, :enabled, :disabled, :default, :target, :read-only, :read-write, :placeholder-shown, :indeterminate, :valid, :invalid, :in-range, :out-of-range, :required, :optional, or :blank.
- Never use ::before, ::after, ::first-line, ::first-letter, ::marker, ::backdrop, ::cue, ::part(), or ::slotted(). They do not render.
- Avoid complex attribute selectors such as [attr^="value"], [attr$="value"], and [attr*="value"] because support is partial.

## Responsive sizing, units, and functions

- Prefer px, %, vw, vh, and rem. rpx works in Lynx but is less portable to Web.
- Do not use cm, mm, in, pt, pc, ch, ex, vmin, or vmax.
- Use rem plus vw instead of media queries. Set the page root font-size to calc(100vw / 23.4375), so 1rem equals 16px at a 375px viewport.
- calc() is for length properties only: width/height/min/max sizes; top/right/bottom/left; individual padding and margin sides; flex-basis; grid/row/column gaps; font-size; text-indent; perspective; and supported logical margin, padding, or inset sides.
- Never use calc() for colors, enums, border-radius, transform, opacity, or z-index.
- Do not use min(), max(), clamp(), or stretch.
- Only env(safe-area-inset-top), env(safe-area-inset-right), env(safe-area-inset-bottom), and env(safe-area-inset-left) are supported env() values.

## At-rules

- Never use @media. Implement responsive behavior with rem, vw/vh, percentages, or main-thread JavaScript.
- Do not use @layer, @supports, @charset, or @namespace.
- Avoid @import, @font-face, and advanced @keyframes behavior because support is partial. Prefer system fonts and simple static styles.

## Grid and Flex details

- Grid is a subset. Do not use named grid lines, grid-column, grid-row, or grid-area shorthands. Use grid-column-start/end and grid-row-start/end.
- Use minmax() only for simple Grid cases.
- flex-basis:min-content behaves as 0px and flex-basis:max-content behaves as auto. Prefer explicit lengths, percentages, or auto.

## Other unsupported or partial features

- Do not use content, pointer-events, cursor, resize, scroll-behavior, scroll-snap properties, overscroll-behavior, transform-style, table layout properties, or currentColor.
- Use only CSS needed for the requested UI. When support is uncertain, replace the feature with a simpler Flex/Linear layout, explicit size, solid color, ordinary border, opacity, or Element PAPI node.`;

function loadSkill(root: string, files: readonly string[]): string {
  return files.map((relativePath) => {
    return `<!-- ${relativePath} -->\n${
      fs.readFileSync(
        path.join(root, relativePath),
        'utf8',
      ).trim()
    }`;
  }).join('\n\n');
}

function loadVanillaLynxSkill(): string {
  if (cachedVanillaLynxSkill !== undefined) {
    return cachedVanillaLynxSkill;
  }

  cachedVanillaLynxSkill = loadSkill(
    VANILLA_LYNX_SKILL_ROOT,
    VANILLA_LYNX_SKILL_FILES,
  );
  return cachedVanillaLynxSkill;
}

/**
 * Build the Lynx XML system prompt from the installed vanilla-lynx Skill and
 * explicit Lynx CSS rules.
 *
 * Lynx XML-specific rules adapt their project and CLI-oriented guidance to
 * a single zero-build artifact.
 */
export function buildLynxXmlSystemPrompt(
  options: BuildLynxXmlSystemPromptOptions = {},
): string {
  const vanillaLynxSkill = loadVanillaLynxSkill();
  const prompt =
    `You generate complete, runnable Lynx XML artifacts from user descriptions.

The following Skill and references from the installed @lynx-js/skill-vanilla-lynx package are authoritative for Element PAPI rendering, lifecycle events, and main/background thread boundaries.

<vanilla-lynx-skill>
${vanillaLynxSkill}
</vanilla-lynx-skill>

The following explicit CSS rules are authoritative for generated styles.

<lynx-css-rules>
${LYNX_CSS_RULES}
</lynx-css-rules>

Apply this Lynx XML protocol adapter after the Skill. The adapter overrides only the Skill's file-layout, TypeScript-entry, Rspeedy-build, and .bundle-output instructions:

- Return exactly one artifact and nothing else. Do not wrap it in Markdown fences. Start with <!DOCTYPE lynx>.
- Emit exactly one non-empty <style> section followed by exactly one <script main-thread> section. Add one <script background> section only when background work is necessary.
- Put plain, self-contained JavaScript in script sections. Do not emit imports, exports, TypeScript annotations, separate files, build commands, or external runtime dependencies.
- Assign the initial renderer as globalThis.renderPage = function renderPage() { ... }. Create the page once with __CreatePage and build its tree with __AppendElement.
- Create every scrollable container with __CreateScrollView(pageId), never __CreateView or __CreateElement. Configure its scroll direction and behavior with __SetAttribute, then append its content as child elements.
- If the page content may exceed one viewport, the outermost content container appended directly to page must be a vertical __CreateScrollView(pageId). Put all page sections inside that root scroll view, give it an explicit bounded viewport height such as height:100vh, and do not place an outer __CreateView between page and the root scroll view.
- Never use React, ReactLynx, ReactDOM, JSX, a virtual DOM, document, window, HTML elements, or browser DOM APIs.
- Never write JSX tags such as <view>, <text>, or <Component>. Construct every node with explicit Element PAPI calls.
- The main-thread script is accepted only when it contains __CreatePage, __AppendElement, and an assignment to globalThis.renderPage.
- The main-thread script is rejected if it references React, ReactDOM, jsx, jsxs, or jsxDEV, or contains any JSX opening, closing, or self-closing tag.
- Before responding, inspect the main-thread script and rewrite every component function, JSX expression, React runtime call, or markup string as plain Element PAPI statements.
- Before responding, verify that every style and script section has its matching closing tag and that the artifact ends immediately after the final closing script tag.
- Reserve enough output for all closing braces and tags. Prefer a smaller complete UI over a larger truncated artifact, and finish the required main-thread script before adding optional background work or decorative detail.
- Never emit a literal closing script tag inside JavaScript strings or comments because it terminates the XML section.
- Keep optional network access out of generated code unless the user explicitly requests live remote data.

Required artifact shape:
<!DOCTYPE lynx>
<style>
  /* Lynx CSS */
</style>
<script main-thread>
  /* plain JavaScript using Element PAPI */
</script>
<script background>
  /* optional plain JavaScript; omit this whole section unless needed */
</script>

Quality requirements:
- Produce a polished, complete mobile UI, not a wireframe.
- Include realistic content from the user request and accessible aria-label attributes on interactive nodes.
- Put all visible strings inside __CreateText with __CreateRawText. Never append a bare string to a view.
- Put styles in <style> and apply CSS classes. Use display:flex for flexible row/column layouts; Lynx otherwise defaults to linear layout.
- Set box-sizing:border-box explicitly where sizing matters. Lynx has no margin collapsing.
- Use rem plus vw for responsive sizing. Set the page root font-size to calc(100vw / 23.4375), making 1rem equal 16px at 375px.
- Use only supported Lynx CSS. Do not use display:inline, display:inline-block, float, position:static, ::before, ::after, structural pseudo-classes, grid-column/grid-row shorthands, or unsupported physical units.
- Prefer class selectors and a shallow element tree. Use explicit widths/heights for images and scroll containers.
`;

  const appendix = options.appendix?.trim();
  return appendix ? `${prompt}\nAdditional requirements:\n${appendix}` : prompt;
}
