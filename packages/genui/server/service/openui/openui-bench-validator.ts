// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  createLibrary,
  createParser,
  enrichErrors,
} from '@openuidev/lang-core';
import type {
  ElementNode,
  LibraryJSONSchema,
  OpenUIError,
  ParseResult,
  Parser,
} from '@openuidev/lang-core';

import { createOpenUiPromptLibrary } from '@lynx-js/genui-openui/openui-prompt';
import type { OpenUiPromptLibrary } from '@lynx-js/genui-openui/openui-prompt';

export const OPENUI_BENCH_ROOT_COMPONENT = 'Column';

export const OPENUI_BENCH_MATCHED_COMPONENTS = Object.freeze(
  [
    'Column',
    'Row',
    'List',
    'Card',
    'Text',
    'TextContent',
    'Button',
    'Divider',
  ] as const,
);

export interface OpenUIBenchValidationError {
  source: 'generation' | 'parser';
  code: string;
  message: string;
  statementId?: string;
  component?: string;
  path?: string;
  hint?: string;
}

export interface OpenUIBenchComplexity {
  outputChars: number;
  statementCount: number;
  componentCount: number;
  componentTypes: Record<string, number>;
  maxComponentDepth: number;
  partialComponentCount: number;
  stateDeclarationCount: number;
  queryCount: number;
  mutationCount: number;
  unresolvedReferenceCount: number;
  orphanedStatementCount: number;
  unknownComponentCount: number;
}

export interface OpenUIBenchValidationResult {
  valid: boolean;
  rawText: string;
  parseResult: ParseResult | null;
  errors: OpenUIBenchValidationError[];
  warnings: string[];
  complexity: OpenUIBenchComplexity;
}

export interface OpenUIBenchValidator {
  readonly componentNames: readonly string[];
  validate(rawText: string): OpenUIBenchValidationResult;
}

function emptyComplexity(rawText: string): OpenUIBenchComplexity {
  return {
    outputChars: rawText.length,
    statementCount: 0,
    componentCount: 0,
    componentTypes: {},
    maxComponentDepth: 0,
    partialComponentCount: 0,
    stateDeclarationCount: 0,
    queryCount: 0,
    mutationCount: 0,
    unresolvedReferenceCount: 0,
    orphanedStatementCount: 0,
    unknownComponentCount: 0,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isElementNode(value: unknown): value is ElementNode {
  return isRecord(value)
    && value.type === 'element'
    && typeof value.typeName === 'string'
    && isRecord(value.props);
}

function measureComplexity(
  rawText: string,
  result: ParseResult,
  errors: OpenUIBenchValidationError[],
): OpenUIBenchComplexity {
  const componentTypes = new Map<string, number>();
  const seen = new WeakSet<object>();
  let componentCount = 0;
  let maxComponentDepth = 0;
  let partialComponentCount = 0;

  const visit = (value: unknown, depth: number): void => {
    if (value === null || typeof value !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);

    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth);
      return;
    }

    if (isElementNode(value)) {
      componentCount += 1;
      maxComponentDepth = Math.max(maxComponentDepth, depth);
      if (value.partial) partialComponentCount += 1;
      componentTypes.set(
        value.typeName,
        (componentTypes.get(value.typeName) ?? 0) + 1,
      );
      visit(value.props, depth + 1);
      return;
    }

    for (const nested of Object.values(value)) visit(nested, depth);
  };

  if (result.root) visit(result.root, 1);

  return {
    outputChars: rawText.length,
    statementCount: result.meta.statementCount,
    componentCount,
    componentTypes: Object.fromEntries(
      [...componentTypes.entries()].sort(([left], [right]) =>
        left.localeCompare(right)
      ),
    ),
    maxComponentDepth,
    partialComponentCount,
    stateDeclarationCount: Object.keys(result.stateDeclarations).length,
    queryCount: result.queryStatements.length,
    mutationCount: result.mutationStatements.length,
    unresolvedReferenceCount: result.meta.unresolved.length,
    orphanedStatementCount: result.meta.orphaned.length,
    unknownComponentCount: errors.filter(
      (error) => error.code === 'unknown-component',
    ).length,
  };
}

function normalizeParserError(error: OpenUIError): OpenUIBenchValidationError {
  return {
    source: 'parser',
    code: error.code,
    message: error.message,
    ...(error.statementId ? { statementId: error.statementId } : {}),
    ...(error.component ? { component: error.component } : {}),
    ...(error.path ? { path: error.path } : {}),
    ...(error.hint ? { hint: error.hint } : {}),
  };
}

function syntheticError(
  code: string,
  message: string,
  hint: string,
): OpenUIBenchValidationError {
  return {
    source: 'parser',
    code,
    message,
    hint,
  };
}

function createOpenUIBenchLibrary(): OpenUiPromptLibrary {
  const fullLibrary = createOpenUiPromptLibrary({
    root: OPENUI_BENCH_ROOT_COMPONENT,
  });
  const components = OPENUI_BENCH_MATCHED_COMPONENTS.map((name) => {
    const component = fullLibrary.components[name];
    if (!component) {
      throw new Error(
        `OpenUI benchmark component "${name}" is missing from the prompt library.`,
      );
    }
    return component;
  });
  return createLibrary({
    root: OPENUI_BENCH_ROOT_COMPONENT,
    components,
    componentGroups: [{
      name: 'Matched Core',
      components: [...OPENUI_BENCH_MATCHED_COMPONENTS],
    }],
  });
}

function enrichParserErrors(
  result: ParseResult,
  schema: LibraryJSONSchema,
  componentNames: string[],
): OpenUIBenchValidationError[] {
  try {
    return enrichErrors(result.meta.errors, schema, componentNames).map(
      (error) => normalizeParserError(error),
    );
  } catch {
    return result.meta.errors.map((error) => ({
      source: 'parser',
      code: error.code,
      message: error.message,
      ...(error.statementId ? { statementId: error.statementId } : {}),
      ...(error.component ? { component: error.component } : {}),
      ...(error.path ? { path: error.path } : {}),
    }));
  }
}

class DefaultOpenUIBenchValidator implements OpenUIBenchValidator {
  public readonly componentNames: readonly string[];

  private readonly parser: Parser;
  private readonly schema: LibraryJSONSchema;

  public constructor(library: OpenUiPromptLibrary) {
    this.schema = library.toJSONSchema();
    this.componentNames = Object.freeze(Object.keys(library.components).sort());
    this.parser = createParser(this.schema, library.root);
  }

  public validate(rawText: string): OpenUIBenchValidationResult {
    if (!rawText.trim()) {
      const error = syntheticError(
        'empty-output',
        'The model returned an empty OpenUI program.',
        'Return one complete OpenUI v0.5 program whose renderable root is assigned to root.',
      );
      return {
        valid: false,
        rawText,
        parseResult: null,
        errors: [error],
        warnings: [],
        complexity: emptyComplexity(rawText),
      };
    }

    let result: ParseResult;
    try {
      result = this.parser.parse(rawText);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const normalized = syntheticError(
        'parse-exception',
        `OpenUI parser crashed: ${message}`,
        'Return plain OpenUI v0.5 code without Markdown fences or prose.',
      );
      return {
        valid: false,
        rawText,
        parseResult: null,
        errors: [normalized],
        warnings: [],
        complexity: emptyComplexity(rawText),
      };
    }

    const errors = enrichParserErrors(
      result,
      this.schema,
      [...this.componentNames],
    );

    if (result.meta.incomplete || result.root?.partial) {
      errors.push(syntheticError(
        'incomplete-output',
        'The OpenUI program is incomplete or truncated.',
        'Return the complete program and close every array, object, string, and component call.',
      ));
    }

    if (result.meta.unresolved.length > 0) {
      errors.push(syntheticError(
        'unresolved-reference',
        `Unresolved OpenUI references: ${result.meta.unresolved.join(', ')}.`,
        'Define every referenced statement and include it in the complete response.',
      ));
    }

    if (result.queryStatements.length > 0) {
      errors.push(syntheticError(
        'query-not-allowed',
        'Query() is not allowed in the matched-core benchmark.',
        'Inline deterministic content directly in the component tree.',
      ));
    }

    if (result.mutationStatements.length > 0) {
      errors.push(syntheticError(
        'mutation-not-allowed',
        'Mutation() is not allowed in the matched-core benchmark.',
        'Use a local Button action or static content instead of external tools.',
      ));
    }

    if (/https?:|file:|\/\//iu.test(rawText)) {
      errors.push(syntheticError(
        'external-url-not-allowed',
        'External URLs are not allowed in the matched-core benchmark.',
        'Do not use remote resources or OpenUrl actions. Only use content supplied by the benchmark scenario.',
      ));
    }

    if (!result.root && errors.length === 0) {
      errors.push(syntheticError(
        'parse-failed',
        'The program did not produce a renderable root component.',
        'Assign a valid catalog component to root, for example root = Column([...]).',
      ));
    }

    const warnings = result.meta.orphaned.length === 0
      ? []
      : [
        `Orphaned OpenUI statements are not reachable from root: ${
          result.meta.orphaned.join(', ')
        }.`,
      ];

    return {
      valid: errors.length === 0,
      rawText,
      parseResult: result,
      errors,
      warnings,
      complexity: measureComplexity(rawText, result, errors),
    };
  }
}

export function createOpenUIBenchValidator(
  library: OpenUiPromptLibrary = createOpenUIBenchLibrary(),
): OpenUIBenchValidator {
  return new DefaultOpenUIBenchValidator(library);
}

const defaultValidator = createOpenUIBenchValidator();

export function validateOpenUIBenchOutput(
  rawText: string,
): OpenUIBenchValidationResult {
  return defaultValidator.validate(rawText);
}
