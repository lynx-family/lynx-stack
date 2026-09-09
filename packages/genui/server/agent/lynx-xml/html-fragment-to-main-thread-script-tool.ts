// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import {
  MAX_XML_FRAGMENT_LENGTH,
  generateMainThreadScriptResult,
  resolveFragmentBindings,
} from '@lynx-js/genui-lynx-xml';
import type { GeneratedMainThreadScript } from '@lynx-js/genui-lynx-xml';

const FRAGMENT_SCRIPT_RUN_STATE_KEY =
  'lynx-xml:html-fragment-script-run-state' as const;
const FRAGMENT_SCRIPT_PLACEHOLDER_PATTERN =
  /^\/\*__GENUI_HTML_FRAGMENT_[0-9a-f-]{36}__\*\/$/u;
const FRAGMENT_SCRIPT_PLACEHOLDER_IN_SOURCE_PATTERN =
  /\/\*__GENUI_HTML_FRAGMENT_[0-9a-f-]{36}__\*\//gu;

export interface HtmlFragmentScriptMetadata extends Record<string, unknown> {
  xmlFragment: string;
}

interface FragmentScriptReplacement {
  bindings: Record<string, string>;
  declarations: string;
  xmlFragment: string;
  javascript: string;
  placeholder: string;
}

interface FragmentScriptRunState {
  replacements: FragmentScriptReplacement[];
}

type FragmentScriptRequestContextValues = Record<
  typeof FRAGMENT_SCRIPT_RUN_STATE_KEY,
  FragmentScriptRunState
>;

export interface HtmlFragmentScriptRunScope {
  requestContext: RequestContext<FragmentScriptRequestContextValues>;
}

/** Create isolated storage for fragment scripts generated during one run. */
export function createHtmlFragmentScriptRunScope(): HtmlFragmentScriptRunScope {
  const requestContext = new RequestContext<
    FragmentScriptRequestContextValues
  >();
  requestContext.set(FRAGMENT_SCRIPT_RUN_STATE_KEY, { replacements: [] });
  return { requestContext };
}

/** Expose only the original converter input as client-facing metadata. */
export function getHtmlFragmentScriptMetadata(
  scope: HtmlFragmentScriptRunScope,
): HtmlFragmentScriptMetadata | undefined {
  const replacement = scope.requestContext.get(FRAGMENT_SCRIPT_RUN_STATE_KEY)
    .replacements[0];
  return replacement ? { xmlFragment: replacement.xmlFragment } : undefined;
}

/** Count exact, non-overlapping occurrences of a value. */
function countOccurrences(source: string, value: string): number {
  let count = 0;
  let offset = 0;
  while (offset < source.length) {
    const next = source.indexOf(value, offset);
    if (next === -1) break;
    count++;
    offset = next + value.length;
  }
  return count;
}

/** Escape a literal string for use in a regular expression. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/** Replace registered fragment placeholders before final artifact delivery. */
export function resolveHtmlFragmentScriptPlaceholders(
  scope: HtmlFragmentScriptRunScope,
  source: string,
): string {
  const state = scope.requestContext.get(FRAGMENT_SCRIPT_RUN_STATE_KEY);
  if (!state) {
    throw new Error('HTML fragment script run scope is not initialized');
  }

  const knownPlaceholders = new Set(
    state.replacements.map((replacement) => replacement.placeholder),
  );
  const unknownPlaceholder = source.match(
    FRAGMENT_SCRIPT_PLACEHOLDER_IN_SOURCE_PATTERN,
  )?.find((placeholder) => !knownPlaceholders.has(placeholder));
  if (unknownPlaceholder) {
    throw new Error(
      'Lynx XML artifact contains an unknown fragment placeholder',
    );
  }

  let resolved = source;
  for (const replacement of state.replacements) {
    if (countOccurrences(resolved, replacement.placeholder) !== 1) {
      throw new Error(
        'Each generated fragment placeholder must appear exactly once',
      );
    }
    const standalonePlaceholder = new RegExp(
      `^[\\t ]*${escapeRegExp(replacement.placeholder)}[\\t ]*\\r?$`,
      'mu',
    );
    if (!standalonePlaceholder.test(resolved)) {
      throw new Error(
        'Each generated fragment placeholder must appear on its own line',
      );
    }
    resolved = resolved.replace(
      replacement.placeholder,
      replacement.javascript,
    );
  }
  const declarations = state.replacements.map((replacement) =>
    replacement.declarations
  ).filter(Boolean).join('\n');
  if (declarations) {
    const scriptStart = resolved.indexOf('<script thread="main">');
    const scriptEnd = resolved.indexOf('</script>', scriptStart);
    if (scriptStart === -1 || scriptEnd === -1) {
      throw new Error(
        'Fragment node declarations require a complete main-thread script',
      );
    }
    const scriptBodyStart = scriptStart + '<script thread="main">'.length;
    const javascript = resolveFragmentBindings(
      resolved.slice(scriptBodyStart, scriptEnd),
      Object.fromEntries(
        state.replacements.flatMap(item => Object.entries(item.bindings)),
      ),
      declarations,
    );
    resolved = resolved.slice(0, scriptBodyStart) + javascript
      + resolved.slice(scriptEnd);
  }
  return resolved;
}

/** Store one generated script and return its model-visible indirection data. */
function registerHtmlFragmentScript(
  requestContext: RequestContext<FragmentScriptRequestContextValues>,
  generated: GeneratedMainThreadScript,
  xmlFragment: string,
): { bindings: Record<string, string>; placeholder: string } {
  const state = requestContext.get(FRAGMENT_SCRIPT_RUN_STATE_KEY);
  if (!state) {
    throw new Error('HTML fragment script run scope is not initialized');
  }
  if (state.replacements.length > 0) {
    throw new Error(
      'HTML fragment conversion may only be called once per agent run',
    );
  }

  const placeholder = `/*__GENUI_HTML_FRAGMENT_${crypto.randomUUID()}__*/`;
  requestContext.set(FRAGMENT_SCRIPT_RUN_STATE_KEY, {
    replacements: [...state.replacements, {
      bindings: generated.bindings,
      xmlFragment,
      declarations: generated.declarations ?? '',
      javascript: generated.javascript,
      placeholder,
    }],
  });
  return { bindings: generated.bindings, placeholder };
}

const inputSchema = z.object({
  xmlFragment: z.string().min(1).max(MAX_XML_FRAGMENT_LENGTH).describe(
    'A well-formed XML fragment containing the Lynx elements to create.',
  ),
});

const outputSchema = z.object({
  placeholder: z.string().regex(FRAGMENT_SCRIPT_PLACEHOLDER_PATTERN).describe(
    'An opaque comment marker to copy exactly once onto its own line inside renderPage(). The server replaces it with generated Element PAPI JavaScript after model generation.',
  ),
  bindings: z.record(z.string(), z.string().regex(/^node\d+$/u)).describe(
    'A map from XML id attributes to generated JavaScript node variable names. Use the VALUES in handlers and updates: {"cityText":"node5"} means setText(node5, ...), not setText(cityText, ...). XML ids do not declare variables.',
  ),
});

const requestContextSchema = z.object({
  [FRAGMENT_SCRIPT_RUN_STATE_KEY]: z.object({
    replacements: z.array(z.object({
      bindings: z.record(z.string(), z.string().regex(/^node\d+$/u)),
      xmlFragment: z.string().min(1).max(MAX_XML_FRAGMENT_LENGTH),
      declarations: z.string(),
      javascript: z.string().min(1),
      placeholder: z.string().regex(FRAGMENT_SCRIPT_PLACEHOLDER_PATTERN),
    })).max(1),
  }),
});

/** Create the Mastra tool that converts XML fragments into Element PAPI code. */
export function createHtmlFragmentToMainThreadScriptTool() {
  return createTool({
    id: 'html_fragment_to_main_thread_script',
    description:
      'Convert one HTML-like, well-formed XML fragment into server-held Element PAPI JavaScript. Returns only an opaque placeholder to copy exactly once onto its own line inside renderPage(), plus bindings from XML id attributes to generated node variables. The server replaces the placeholder after model generation, and adds hoisted script-level node declarations, so handlers outside renderPage() can use the bindings after rendering. Never expand the placeholder or redeclare the returned node variables. Event handlers and lifecycle code remain the agent\'s responsibility.',
    inputSchema,
    outputSchema,
    requestContextSchema,
    execute: async ({ xmlFragment }, context) =>
      registerHtmlFragmentScript(
        context.requestContext as RequestContext<
          FragmentScriptRequestContextValues
        >,
        generateMainThreadScriptResult(xmlFragment, { nodeScope: 'script' }),
        xmlFragment,
      ),
  });
}
