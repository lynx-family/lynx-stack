// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createHash } from 'node:crypto'

import type {
  BabelFileResult,
  NodePath,
  PluginObj,
  TransformOptions,
} from '@babel/core'
import { types as t, transformSync } from '@babel/core'
import type { DefaultTreeAdapterTypes } from 'parse5'
import { parseFragment } from 'parse5'

export const SOLID_ELEMENT_TEMPLATE_BUILD_INFO = 'lynx:solid-element-templates'

interface CompiledTemplateAsset {
  compiledTemplate: Record<string, unknown>
  templateId: string
}

interface TemplateNode {
  attributeSlots: Map<string, number>
  attributes: ReadonlyArray<{ name: string, value: string }>
  children: TemplateNode[]
  dynamicAttributes: Set<string>
  dynamicText: boolean
  insertionBoundarySlots: Map<TemplateNode | null, number>
  insertionBoundaries: Set<TemplateNode | null>
  kind: 'element' | 'marker' | 'text'
  parent: TemplateNode | undefined
  spread: boolean
  spreadAttributeSlotIndex: number | undefined
  textContentAttributeSlotIndex: number | undefined
  type: string
  value: string
}

interface TemplateDefinition {
  callPath: NodePath<t.CallExpression>
  root: TemplateNode
  templateId: string
}

interface BoundTemplateNode {
  definition: TemplateDefinition
  node: TemplateNode
  rootBinding: BabelBinding
}

type TemplateOperation =
  | {
    callPath: NodePath<t.CallExpression>
    kind: 'attribute'
    name: string
    target: BoundTemplateNode
    valueArgumentIndex: number
  }
  | {
    callPath: NodePath<t.CallExpression>
    kind: 'child'
    target: BoundTemplateNode
    anchor: TemplateNode | null
  }
  | {
    callPath: NodePath<t.CallExpression>
    kind: 'spread'
    target: BoundTemplateNode
  }
  | {
    callPath: NodePath<t.CallExpression>
    kind: 'text'
    target: BoundTemplateNode
  }

type BabelBinding = NonNullable<
  ReturnType<NodePath['scope']['getBinding']>
>

export interface SolidElementTemplateTransformResult {
  code: string
  elementTemplates: CompiledTemplateAsset[]
  map: BabelFileResult['map']
}

function createTemplateNode(
  kind: TemplateNode['kind'],
  parent: TemplateNode | undefined,
  options: {
    attributes?: TemplateNode['attributes']
    type?: string
    value?: string
  } = {},
): TemplateNode {
  return {
    attributeSlots: new Map(),
    attributes: options.attributes ?? [],
    children: [],
    dynamicAttributes: new Set(),
    dynamicText: false,
    insertionBoundarySlots: new Map(),
    insertionBoundaries: new Set(),
    kind,
    parent,
    spread: false,
    spreadAttributeSlotIndex: undefined,
    textContentAttributeSlotIndex: undefined,
    type: options.type ?? '',
    value: options.value ?? '',
  }
}

function parseNode(
  node: DefaultTreeAdapterTypes.ChildNode,
  parent: TemplateNode | undefined,
): TemplateNode | undefined {
  if (node.nodeName === '#comment') {
    return createTemplateNode('marker', parent)
  }
  if (node.nodeName === '#text') {
    const textNode = node as DefaultTreeAdapterTypes.TextNode
    if (textNode.value.length === 0) {
      return undefined
    }
    return createTemplateNode('text', parent, { value: textNode.value })
  }
  if (node.nodeName === '#documentType') {
    return undefined
  }

  const element = node as DefaultTreeAdapterTypes.Element
  const result = createTemplateNode('element', parent, {
    attributes: element.attrs,
    type: element.tagName,
  })
  for (const child of element.childNodes) {
    const parsed = parseNode(child, result)
    if (parsed !== undefined) {
      result.children.push(parsed)
    }
  }
  return result
}

function parseTemplateRoot(source: string): TemplateNode {
  const fragment = parseFragment(source)
  let roots = fragment.childNodes
    .map(node => parseNode(node, undefined))
    .filter(node => node !== undefined)

  if (
    roots.length === 1
    && roots[0]?.kind === 'element'
    && roots[0].type === 'svg'
  ) {
    roots = roots[0].children.filter(node => node.kind !== 'marker')
    for (const root of roots) {
      root.parent = undefined
    }
  }

  if (roots.length !== 1 || roots[0]?.kind !== 'element') {
    throw new Error(
      'SolidLynx compiled templates must contain exactly one element root.',
    )
  }
  return roots[0]
}

function getStaticString(value: unknown): string | undefined {
  if (
    typeof value === 'object'
    && value !== null
    && 'type' in value
  ) {
    const node = value as {
      type: string
      value?: string
      expressions?: unknown[]
      quasis?: Array<{ value: { cooked?: string | null, raw: string } }>
    }
    if (node.type === 'StringLiteral') {
      return node.value
    }
    if (
      node.type === 'TemplateLiteral'
      && node.expressions?.length === 0
      && node.quasis?.length === 1
    ) {
      return node.quasis[0]?.value.cooked ?? node.quasis[0]?.value.raw
    }
  }
  return undefined
}

function importedName(binding: BabelBinding | undefined): string | undefined {
  const path = binding?.path
  if (path?.isImportSpecifier()) {
    const imported = path.node.imported
    return imported.type === 'Identifier' ? imported.name : imported.value
  }
  return undefined
}

function boundTemplateNode(
  path: NodePath,
  value: unknown,
  nodesByBinding: Map<BabelBinding, BoundTemplateNode>,
): BoundTemplateNode | undefined {
  if (
    typeof value !== 'object'
    || value === null
    || !('type' in value)
    || value.type !== 'Identifier'
    || !('name' in value)
    || typeof value.name !== 'string'
  ) {
    return undefined
  }
  const binding = path.scope.getBinding(value.name)
  return binding === undefined ? undefined : nodesByBinding.get(binding)
}

function propertyName(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || !('type' in value)) {
    return undefined
  }
  if (value.type === 'Identifier' && 'name' in value) {
    return typeof value.name === 'string' ? value.name : undefined
  }
  if (value.type === 'StringLiteral' && 'value' in value) {
    return typeof value.value === 'string' ? value.value : undefined
  }
  return undefined
}

function childForProperty(
  node: TemplateNode,
  property: string,
): TemplateNode | undefined {
  if (property === 'firstChild') {
    return node.children[0]
  }
  if (property !== 'nextSibling' || node.parent === undefined) {
    return undefined
  }
  const index = node.parent.children.indexOf(node)
  return index < 0 ? undefined : node.parent.children[index + 1]
}

function childSlot(
  elementSlotIndex: number,
): Record<string, unknown> {
  return {
    kind: 'childSlot',
    type: 'slot',
    elementSlotIndex,
  }
}

function compileTemplate(
  root: TemplateNode,
): Record<string, unknown> {
  let nextAttributeSlotIndex = 0
  let nextChildSlotIndex = 0

  const compileNode = (
    node: TemplateNode,
  ): Record<string, unknown> => {
    if (node.kind === 'text') {
      return {
        kind: 'element',
        type: 'raw-text',
        attributesArray: [{
          kind: 'static',
          key: 'text',
          value: node.value,
        }],
        children: [],
      }
    }

    const attributesArray: Record<string, unknown>[] = []
    for (const name of node.dynamicAttributes) {
      const attrSlotIndex = nextAttributeSlotIndex++
      node.attributeSlots.set(name, attrSlotIndex)
      attributesArray.push({
        kind: 'slot',
        key: name,
        attrSlotIndex,
      })
    }
    node.spreadAttributeSlotIndex = node.spread
      ? nextAttributeSlotIndex++
      : undefined
    if (node.spreadAttributeSlotIndex !== undefined) {
      attributesArray.push({
        kind: 'spread',
        attrSlotIndex: node.spreadAttributeSlotIndex,
      })
    }
    for (const attribute of node.attributes) {
      attributesArray.push({
        kind: 'static',
        key: attribute.name,
        value: attribute.value,
      })
    }

    const children: Record<string, unknown>[] = []
    node.textContentAttributeSlotIndex = node.dynamicText
      ? nextAttributeSlotIndex++
      : undefined
    if (node.textContentAttributeSlotIndex !== undefined) {
      children.push({
        kind: 'element',
        type: 'raw-text',
        attributesArray: [{
          kind: 'slot',
          key: 'text',
          attrSlotIndex: node.textContentAttributeSlotIndex,
        }],
        children: [],
      })
    }
    for (const child of node.children) {
      if (node.insertionBoundaries.has(child)) {
        const boundarySlot = nextChildSlotIndex++
        node.insertionBoundarySlots.set(child, boundarySlot)
        children.push(childSlot(boundarySlot))
      }
      if (child.kind === 'marker') {
        continue
      }

      children.push(compileNode(child))
    }

    if (node.insertionBoundaries.has(null)) {
      const boundarySlot = nextChildSlotIndex++
      node.insertionBoundarySlots.set(null, boundarySlot)
      children.push(childSlot(boundarySlot))
    }

    return {
      kind: 'element',
      type: node.type,
      attributesArray,
      children,
    }
  }

  return compileNode(root)
}

function createTransformPlugin(): PluginObj {
  return {
    name: 'solid-lynx-element-template',
    visitor: {
      Program: {
        exit(programPath, state) {
          const templateBindings = new Set<BabelBinding>()
          const helperBindings = new Map<BabelBinding, string>()
          const importedHelperIdentifiers = new Map<string, t.Identifier>()
          let solidImportPath: NodePath<t.ImportDeclaration> | undefined
          programPath.get('body').forEach(statementPath => {
            if (
              !statementPath.isImportDeclaration()
              || statementPath.node.source.value !== '@lynx-js/solid'
            ) {
              return
            }
            solidImportPath ??= statementPath
            for (const specifierPath of statementPath.get('specifiers')) {
              if (!specifierPath.isImportSpecifier()) {
                continue
              }
              const binding = programPath.scope.getBinding(
                specifierPath.node.local.name,
              )
              if (binding === undefined) {
                continue
              }
              const name = importedName(binding)
              if (name === 'template') {
                templateBindings.add(binding)
                specifierPath.node.imported = t.identifier('createTemplate')
              } else if (name !== undefined) {
                helperBindings.set(binding, name)
                importedHelperIdentifiers.set(
                  name,
                  specifierPath.node.local,
                )
              }
            }
          })

          if (templateBindings.size === 0) {
            return
          }

          const runtimeHelperIdentifiers = new Map(
            importedHelperIdentifiers,
          )
          const runtimeHelperIdentifier = (name: string): t.Identifier => {
            const existing = runtimeHelperIdentifiers.get(name)
            if (existing !== undefined) {
              return t.cloneNode(existing)
            }
            if (solidImportPath === undefined) {
              throw new Error(
                'SolidLynx runtime helpers require an @lynx-js/solid import.',
              )
            }
            const local = programPath.scope.generateUidIdentifier(name)
            solidImportPath.node.specifiers.push(
              t.importSpecifier(local, t.identifier(name)),
            )
            runtimeHelperIdentifiers.set(name, local)
            return t.cloneNode(local)
          }

          const definitionsByBinding = new Map<
            BabelBinding,
            TemplateDefinition
          >()
          const definitions: TemplateDefinition[] = []
          programPath.traverse({
            VariableDeclarator(path) {
              const id = path.node.id
              const initPath = path.get('init')
              if (id.type !== 'Identifier' || !initPath.isCallExpression()) {
                return
              }
              const init = path.node.init
              if (
                init?.type !== 'CallExpression'
                || init.callee.type !== 'Identifier'
              ) {
                return
              }
              const calleeBinding = path.scope.getBinding(init.callee.name)
              if (
                calleeBinding === undefined
                || !templateBindings.has(calleeBinding)
              ) {
                return
              }
              const source = getStaticString(init.arguments[0])
              if (source === undefined) {
                throw path.buildCodeFrameError(
                  'SolidLynx template() expects a static template string.',
                )
              }
              const templateId = `_solid_et_${
                createHash('sha256').update(source).digest('hex').slice(0, 12)
              }`
              const definition: TemplateDefinition = {
                callPath: initPath,
                root: parseTemplateRoot(source),
                templateId,
              }
              const binding = path.scope.getBinding(id.name)
              if (binding !== undefined) {
                definitionsByBinding.set(binding, definition)
              }
              definitions.push(definition)
            },
          })

          const nodesByBinding = new Map<BabelBinding, BoundTemplateNode>()
          const navigationDeclarators: Array<{
            binding: BabelBinding
            path: NodePath<t.VariableDeclarator>
          }> = []
          const operations: TemplateOperation[] = []
          programPath.traverse({
            VariableDeclarator(path) {
              const id = path.node.id
              if (id.type !== 'Identifier' || path.node.init == null) {
                return
              }
              let target: BoundTemplateNode | undefined
              const init = path.node.init
              if (
                init.type === 'CallExpression'
                && init.callee.type === 'Identifier'
              ) {
                const factoryBinding = path.scope.getBinding(init.callee.name)
                const definition = factoryBinding === undefined
                  ? undefined
                  : definitionsByBinding.get(factoryBinding)
                const binding = path.scope.getBinding(id.name)
                if (definition !== undefined && binding !== undefined) {
                  target = {
                    definition,
                    node: definition.root,
                    rootBinding: binding,
                  }
                }
              } else if (
                init.type === 'MemberExpression'
                && !init.computed
              ) {
                const parent = boundTemplateNode(
                  path,
                  init.object,
                  nodesByBinding,
                )
                const property = propertyName(init.property)
                const node = parent === undefined || property === undefined
                  ? undefined
                  : childForProperty(parent.node, property)
                if (parent !== undefined && node !== undefined) {
                  target = {
                    definition: parent.definition,
                    node,
                    rootBinding: parent.rootBinding,
                  }
                }
              }
              const binding = path.scope.getBinding(id.name)
              if (target !== undefined && binding !== undefined) {
                nodesByBinding.set(binding, target)
                if (binding !== target.rootBinding) {
                  navigationDeclarators.push({ binding, path })
                }
              }
            },
            CallExpression(path) {
              if (path.node.callee.type !== 'Identifier') {
                return
              }
              const binding = path.scope.getBinding(path.node.callee.name)
              const helper = binding === undefined
                ? undefined
                : helperBindings.get(binding)
              const target = boundTemplateNode(
                path,
                path.node.arguments[0],
                nodesByBinding,
              )
              if (target === undefined || helper === undefined) {
                return
              }

              if (helper === 'insert') {
                const anchorValue = path.node.arguments[2]
                const anchor = anchorValue === undefined
                    || anchorValue.type === 'NullLiteral'
                    || anchorValue.type === 'UnaryExpression'
                  ? null
                  : boundTemplateNode(path, anchorValue, nodesByBinding)
                if (
                  anchor !== null
                  && (
                    anchor === undefined
                    || anchor.node.parent !== target.node
                    || anchor.rootBinding !== target.rootBinding
                  )
                ) {
                  throw path.buildCodeFrameError(
                    'SolidLynx could not resolve the static insertion anchor.',
                  )
                }
                if (
                  anchor === null
                  && target.node.kind === 'element'
                  && target.node.type === 'text'
                  && target.node.children.length === 0
                ) {
                  target.node.dynamicText = true
                  operations.push({
                    callPath: path,
                    kind: 'text',
                    target,
                  })
                  return
                }
                const anchorNode = anchor?.node ?? null
                target.node.insertionBoundaries.add(anchorNode)
                operations.push({
                  anchor: anchorNode,
                  callPath: path,
                  kind: 'child',
                  target,
                })
                return
              }

              if (helper === 'spread') {
                target.node.spread = true
                operations.push({
                  callPath: path,
                  kind: 'spread',
                  target,
                })
                return
              }

              const name = helper === 'className'
                ? 'class'
                : getStaticString(path.node.arguments[1])
              if (
                (helper === 'setAttribute' || helper === 'setProperty'
                  || helper === 'setProp')
              ) {
                if (name === undefined) {
                  throw path.buildCodeFrameError(
                    'SolidLynx Element Template attribute names must be static.',
                  )
                }
                target.node.dynamicAttributes.add(name)
                operations.push({
                  callPath: path,
                  kind: 'attribute',
                  name,
                  target,
                  valueArgumentIndex: 2,
                })
                return
              }
              if (helper === 'className') {
                target.node.dynamicAttributes.add('class')
                operations.push({
                  callPath: path,
                  kind: 'attribute',
                  name: 'class',
                  target,
                  valueArgumentIndex: 1,
                })
              }
            },
          })

          const operationCallNodes = new Set(
            operations.map(operation => operation.callPath.node),
          )
          const navigationDeclaratorNodes = new Set(
            navigationDeclarators.map(({ path }) => path.node),
          )
          for (const { binding, path } of navigationDeclarators) {
            for (const referencePath of binding.referencePaths) {
              const parentPath = referencePath.parentPath
              const usedByNavigation = parentPath?.isMemberExpression()
                && parentPath.node.object === referencePath.node
                && parentPath.parentPath?.isVariableDeclarator()
                && navigationDeclaratorNodes.has(parentPath.parentPath.node)
              const usedByOperation = parentPath?.isCallExpression()
                && operationCallNodes.has(parentPath.node)
              if (!usedByNavigation && !usedByOperation) {
                throw path.buildCodeFrameError(
                  'SolidLynx cannot expose a static Element Template node at runtime.',
                )
              }
            }
          }

          const assetsById = new Map<string, CompiledTemplateAsset>()
          for (const definition of definitions) {
            const compiledTemplate = compileTemplate(definition.root)
            const existing = assetsById.get(definition.templateId)
            if (
              existing !== undefined
              && JSON.stringify(existing.compiledTemplate)
                !== JSON.stringify(compiledTemplate)
            ) {
              throw definition.callPath.buildCodeFrameError(
                `SolidLynx Element Template id collision: ${definition.templateId}.`,
              )
            }
            assetsById.set(definition.templateId, {
              compiledTemplate,
              templateId: definition.templateId,
            })
            definition.callPath.node.arguments = [
              t.stringLiteral(definition.templateId),
            ]
          }

          for (const operation of operations) {
            const root = t.identifier(
              operation.target.rootBinding.identifier.name,
            )
            if (operation.kind === 'attribute') {
              const slot = operation.target.node.attributeSlots.get(
                operation.name,
              )
              if (slot === undefined) {
                throw operation.callPath.buildCodeFrameError(
                  `SolidLynx did not compile an attribute slot for "${operation.name}".`,
                )
              }
              operation.callPath.node.callee = runtimeHelperIdentifier(
                'setTemplateAttribute',
              )
              operation.callPath.node.arguments = [
                root,
                t.numericLiteral(slot),
                t.stringLiteral(operation.name),
                ...operation.callPath.node.arguments.slice(
                  operation.valueArgumentIndex,
                ),
              ]
              continue
            }
            if (operation.kind === 'spread') {
              const slot = operation.target.node.spreadAttributeSlotIndex
              if (slot === undefined) {
                throw operation.callPath.buildCodeFrameError(
                  'SolidLynx did not compile a spread attribute slot.',
                )
              }
              operation.callPath.node.callee = runtimeHelperIdentifier(
                'spreadTemplateAttributes',
              )
              operation.callPath.node.arguments = [
                root,
                t.numericLiteral(slot),
                ...operation.callPath.node.arguments.slice(1),
              ]
              continue
            }
            if (operation.kind === 'text') {
              const slot = operation.target.node.textContentAttributeSlotIndex
              if (slot === undefined) {
                throw operation.callPath.buildCodeFrameError(
                  'SolidLynx did not compile a text attribute slot.',
                )
              }
              operation.callPath.node.callee = runtimeHelperIdentifier(
                'setTemplateText',
              )
              operation.callPath.node.arguments = [
                root,
                t.numericLiteral(slot),
                operation.callPath.node.arguments[1]
                  ?? t.unaryExpression('void', t.numericLiteral(0)),
              ]
              continue
            }

            const slot = operation.target.node.insertionBoundarySlots.get(
              operation.anchor,
            )
            if (slot === undefined) {
              throw operation.callPath.buildCodeFrameError(
                'SolidLynx did not compile a child slot.',
              )
            }
            const initial = operation.callPath.node.arguments[3]
            operation.callPath.node.callee = runtimeHelperIdentifier(
              'insertTemplateChild',
            )
            operation.callPath.node.arguments = [
              root,
              t.numericLiteral(slot),
              operation.callPath.node.arguments[1]
                ?? t.unaryExpression('void', t.numericLiteral(0)),
              ...(initial === undefined ? [] : [initial]),
            ]
          }

          const enclosingEffect = (
            path: NodePath,
          ): NodePath<t.CallExpression> | undefined => {
            let current = path.parentPath
            while (current !== null && current !== programPath) {
              if (
                current.isCallExpression()
                && current.node.callee.type === 'Identifier'
              ) {
                const binding = current.scope.getBinding(
                  current.node.callee.name,
                )
                if (
                  binding !== undefined
                  && helperBindings.get(binding) === 'effect'
                ) {
                  return current
                }
              }
              current = current.parentPath
            }
            return undefined
          }
          const textOperationsByRoot = new Map<
            BabelBinding,
            Extract<TemplateOperation, { kind: 'text' }>[]
          >()
          for (const operation of operations) {
            if (operation.kind !== 'text') {
              continue
            }
            const group = textOperationsByRoot.get(
              operation.target.rootBinding,
            ) ?? []
            group.push(operation)
            textOperationsByRoot.set(operation.target.rootBinding, group)
          }
          for (const [rootBinding, textOperations] of textOperationsByRoot) {
            const attributeEffects = new Set<NodePath<t.CallExpression>>()
            for (const operation of operations) {
              if (
                operation.kind !== 'attribute'
                || operation.target.rootBinding !== rootBinding
              ) {
                continue
              }
              const effectCall = enclosingEffect(operation.callPath)
              if (effectCall !== undefined) {
                attributeEffects.add(effectCall)
              }
            }
            if (attributeEffects.size > 1) {
              throw textOperations[0]!.callPath.buildCodeFrameError(
                'SolidLynx expects one attribute effect per compiled template instance.',
              )
            }

            const statements = textOperations.map(operation => {
              const statement = operation.callPath.parentPath
              if (!statement?.isExpressionStatement()) {
                throw operation.callPath.buildCodeFrameError(
                  'SolidLynx text slot updates must be expression statements.',
                )
              }
              return statement
            })
            const updates = textOperations.map(operation =>
              t.expressionStatement(t.cloneNode(operation.callPath.node))
            )
            const [attributeEffect] = attributeEffects
            if (attributeEffect !== undefined) {
              const callback = attributeEffect.get('arguments')[0]
              if (
                callback === undefined
                || Array.isArray(callback)
                || (
                  !callback.isArrowFunctionExpression()
                  && !callback.isFunctionExpression()
                )
              ) {
                throw attributeEffect.buildCodeFrameError(
                  'SolidLynx expects the Solid attribute effect to use a function callback.',
                )
              }
              if (callback.node.body.type === 'BlockStatement') {
                callback.node.body.body.unshift(...updates)
              } else {
                callback.node.body = t.blockStatement([
                  ...updates,
                  t.returnStatement(callback.node.body),
                ])
              }
              for (const statement of statements) {
                statement.remove()
              }
              continue
            }

            statements[0]!.replaceWith(
              t.expressionStatement(
                t.callExpression(runtimeHelperIdentifier('effect'), [
                  t.arrowFunctionExpression([], t.blockStatement(updates)),
                ]),
              ),
            )
            for (const statement of statements.slice(1)) {
              statement.remove()
            }
          }

          for (const { path } of navigationDeclarators.reverse()) {
            path.remove()
          }

          ;(state.file.metadata as Record<string, unknown>)[
            SOLID_ELEMENT_TEMPLATE_BUILD_INFO
          ] = [
            ...assetsById.values(),
          ]
        },
      },
    },
  }
}

export function transformSolidElementTemplates(
  code: string,
  filename: string,
  inputSourceMap?: TransformOptions['inputSourceMap'] | string,
): SolidElementTemplateTransformResult {
  const result = transformSync(code, {
    babelrc: false,
    configFile: false,
    filename,
    inputSourceMap: typeof inputSourceMap === 'string'
      ? JSON.parse(inputSourceMap) as TransformOptions['inputSourceMap']
      : inputSourceMap,
    parserOpts: {
      plugins: ['jsx', 'typescript'],
    },
    plugins: [createTransformPlugin],
    sourceMaps: true,
  })
  if (result?.code === undefined || result.code === null) {
    throw new Error(`Failed to transform SolidLynx module: ${filename}.`)
  }
  return {
    code: result.code,
    elementTemplates: (
      (result.metadata as Record<string, unknown> | undefined)?.[
        SOLID_ELEMENT_TEMPLATE_BUILD_INFO
      ] ?? []
    ) as CompiledTemplateAsset[],
    map: result.map,
  }
}
