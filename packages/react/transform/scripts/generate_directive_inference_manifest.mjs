// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import ts from 'typescript';

export const DIRECTIVE_INFERENCE_PROTOCOL_VERSION = 1;

const DECLARATION_INTERFACE = 'DirectiveInferenceManifest';
const CALL_WRAPPER = 'MainThreadCall';
const COMPONENT_WRAPPER = 'MainThreadComponent';
const MARKER_WRAPPER = 'MainThreadMarker';
const FUNCTION_BRAND = 'MainThreadFn';
const DEEP_BRAND = 'MainThreadDeep';

export function generateDirectiveInferenceManifest(sourceText, filename = 'manifest.d.ts') {
  const source = ts.createSourceFile(
    filename,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const declarations = collectTypeDeclarations(source);
  const root = declarations.get(DECLARATION_INTERFACE);
  if (root === undefined || !ts.isInterfaceDeclaration(root)) {
    throw new Error(
      `${filename} must declare an interface named ${DECLARATION_INTERFACE}.`,
    );
  }

  const exports = {};
  collectExports(root.members, [], exports, declarations, new Set());
  return {
    protocolVersion: DIRECTIVE_INFERENCE_PROTOCOL_VERSION,
    exports: sortObject(exports),
  };
}

export function generateDirectiveInferenceManifestFile(input, output) {
  const manifest = generateDirectiveInferenceManifest(
    fs.readFileSync(input, 'utf8'),
    input,
  );
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

function collectTypeDeclarations(source) {
  const declarations = new Map();
  for (const statement of source.statements) {
    if (
      ts.isInterfaceDeclaration(statement)
      || ts.isTypeAliasDeclaration(statement)
    ) {
      declarations.set(statement.name.text, statement);
    }
  }
  return declarations;
}

function collectExports(members, prefix, exports, declarations, stack) {
  for (const member of members) {
    if (!ts.isPropertySignature(member) || member.type === undefined) {
      continue;
    }
    const name = propertyName(member.name);
    if (name === undefined) {
      throw new Error('Directive-inference export names must be static.');
    }
    const path = [...prefix, name];
    const wrapper = typeReferenceName(member.type);
    if (wrapper === MARKER_WRAPPER) {
      exports[path.join('.')] = { marker: true };
      continue;
    }
    if (wrapper === CALL_WRAPPER) {
      const tuple = member.type.typeArguments?.[0];
      if (tuple === undefined || !ts.isTupleTypeNode(tuple)) {
        throw new Error(`${path.join('.')} must use ${CALL_WRAPPER} with a tuple.`);
      }
      const args = {};
      tuple.elements.forEach((element, index) => {
        const rule = ruleFromType(unwrapTupleElement(element), declarations, stack);
        if (rule !== undefined) {
          args[index] = rule;
        }
      });
      exports[path.join('.')] = { args: sortObject(args) };
      continue;
    }
    if (wrapper === COMPONENT_WRAPPER) {
      const propsType = member.type.typeArguments?.[0];
      if (propsType === undefined) {
        throw new Error(`${path.join('.')} must provide component props.`);
      }
      const props = ruleFromType(propsType, declarations, stack);
      if (props === undefined || props === true || typeof props === 'string') {
        throw new Error(`${path.join('.')} component props must be structural.`);
      }
      exports[path.join('.')] = { props: sortObject(props) };
      continue;
    }

    const nested = resolveMembers(member.type, declarations, stack);
    if (nested === undefined) {
      throw new Error(
        `${path.join('.')} must use ${CALL_WRAPPER}, ${COMPONENT_WRAPPER}, `
          + `${MARKER_WRAPPER}, or a structural namespace.`,
      );
    }
    collectExports(nested, path, exports, declarations, stack);
  }
}

function ruleFromType(node, declarations, stack) {
  const unwrapped = unwrapType(node);
  const reference = typeReferenceName(unwrapped);
  if (reference === FUNCTION_BRAND) {
    return true;
  }
  if (reference === DEEP_BRAND) {
    return '**';
  }
  if (ts.isUnionTypeNode(unwrapped) || ts.isIntersectionTypeNode(unwrapped)) {
    const rules = unwrapped.types
      .map(type => ruleFromType(type, declarations, stack))
      .filter(rule => rule !== undefined);
    if (rules.length === 0) {
      return undefined;
    }
    if (rules.includes('**')) {
      return '**';
    }
    if (rules.includes(true)) {
      return true;
    }
    if (rules.every(rule => JSON.stringify(rule) === JSON.stringify(rules[0]))) {
      return rules[0];
    }
    throw new Error(
      `${ts.isUnionTypeNode(unwrapped) ? 'Union' : 'Intersection'} at `
        + `${unwrapped.getText()} declares incompatible rules.`,
    );
  }
  if (isIgnoredType(unwrapped)) {
    return undefined;
  }
  if (reference !== undefined && !stack.has(reference)) {
    const declaration = declarations.get(reference);
    if (declaration !== undefined && ts.isTypeAliasDeclaration(declaration)) {
      stack.add(reference);
      const rule = ruleFromType(declaration.type, declarations, stack);
      stack.delete(reference);
      return rule;
    }
  }

  const members = resolveMembers(unwrapped, declarations, stack);
  if (members === undefined) {
    return undefined;
  }
  const paths = {};
  for (const member of members) {
    if (!ts.isPropertySignature(member) || member.type === undefined) {
      continue;
    }
    const name = propertyName(member.name);
    if (name === undefined) {
      throw new Error('Directive-inference paths must use static property names.');
    }
    const rule = ruleFromType(member.type, declarations, stack);
    if (rule !== undefined) {
      paths[name] = rule;
    }
  }
  return Object.keys(paths).length === 0 ? undefined : sortObject(paths);
}

function resolveMembers(node, declarations, stack) {
  const unwrapped = unwrapType(node);
  if (ts.isTypeLiteralNode(unwrapped)) {
    return unwrapped.members;
  }
  if (!ts.isTypeReferenceNode(unwrapped)) {
    return undefined;
  }
  const name = typeReferenceName(unwrapped);
  if (name === undefined || stack.has(name)) {
    return undefined;
  }
  const declaration = declarations.get(name);
  if (declaration === undefined) {
    return undefined;
  }
  stack.add(name);
  const members = ts.isInterfaceDeclaration(declaration)
    ? declaration.members
    : resolveMembers(declaration.type, declarations, stack);
  stack.delete(name);
  return members;
}

function unwrapTupleElement(node) {
  if (ts.isNamedTupleMember(node)) {
    return node.type;
  }
  if (ts.isOptionalTypeNode(node) || ts.isRestTypeNode(node)) {
    return node.type;
  }
  return node;
}

function unwrapType(node) {
  if (
    ts.isParenthesizedTypeNode(node)
    || ts.isOptionalTypeNode(node)
    || ts.isRestTypeNode(node)
  ) {
    return unwrapType(node.type);
  }
  return node;
}

function typeReferenceName(node) {
  return ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)
    ? node.typeName.text
    : undefined;
}

function propertyName(node) {
  if (
    ts.isIdentifier(node)
    || ts.isStringLiteral(node)
    || ts.isNumericLiteral(node)
  ) {
    return node.text;
  }
  return undefined;
}

function isIgnoredType(node) {
  return node.kind === ts.SyntaxKind.UndefinedKeyword
    || node.kind === ts.SyntaxKind.NullKeyword
    || node.kind === ts.SyntaxKind.UnknownKeyword
    || node.kind === ts.SyntaxKind.AnyKeyword
    || node.kind === ts.SyntaxKind.NeverKeyword
    || node.kind === ts.SyntaxKind.VoidKeyword
    || node.kind === ts.SyntaxKind.StringKeyword
    || node.kind === ts.SyntaxKind.NumberKeyword
    || node.kind === ts.SyntaxKind.BooleanKeyword
    || ts.isLiteralTypeNode(node);
}

function sortObject(object) {
  return Object.fromEntries(
    Object.entries(object).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if ((key !== '--input' && key !== '--output') || value === undefined) {
      throw new Error(
        'Usage: generate_directive_inference_manifest.mjs '
          + '--input <declarations.d.ts> --output <manifest.json>',
      );
    }
    values.set(key, value);
  }
  const input = values.get('--input');
  const output = values.get('--output');
  if (input === undefined || output === undefined) {
    throw new Error('Both --input and --output are required.');
  }
  return { input, output };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const { input, output } = parseArguments(process.argv.slice(2));
    generateDirectiveInferenceManifestFile(
      path.resolve(input),
      path.resolve(output),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

export const __filename = fileURLToPath(import.meta.url);
