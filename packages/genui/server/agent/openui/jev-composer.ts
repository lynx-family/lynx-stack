// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  createParser,
  isASTNode,
  jsonToOpenUI,
  mergeStatements,
  split,
  tokenize,
} from '@openuidev/lang-core';
import type { ElementNode } from '@openuidev/lang-core';

import { createOpenUiPromptLibrary } from '@lynx-js/genui-openui/openui-prompt';

import {
  buildOpenUIJevCandidates,
  buildOpenUIJevCatalog,
  isOpenUIJevMediaURL,
} from './jev-candidates.js';
import type { OpenUIJevValueChoice } from './jev-candidates.js';
import type {
  ChatMessage,
  ConversationContext,
} from '../../service/common/types.js';
import {
  createJevComponentQuestions,
  createJevCompositionContext,
  createJevPropertyQuestions,
  createJevRetention,
} from '../common/jev-composition.js';
import {
  createJevDecisionRunner,
  jevQuestion as question,
} from '../common/jev-evaluator.js';
import type { JevEvaluationOptions } from '../common/jev-evaluator.js';
import { arrangeJevLayout } from '../common/jev-layout.js';
import {
  JEV_MAX_COMPONENTS,
  JEV_STRUCTURAL_PROPS,
  describeJevComponents,
  isRecord,
  jevChildIds,
} from '../common/jev-tree.js';
import type { JevComponent } from '../common/jev-tree.js';

interface Node {
  tree: JevComponent;
  props: Record<string, unknown>;
}

export interface OpenUIJevOptions extends JevEvaluationOptions {
  messages: ChatMessage[];
  conversation?: ConversationContext | undefined;
  enableDesignGuidance?: boolean | undefined;
  promptComponentNames?: readonly string[] | undefined;
  promptRoot?: string | undefined;
  systemAppendix?: string | undefined;
}

const element = (value: unknown): value is ElementNode =>
  isRecord(value) && value.type === 'element'
  && typeof value.typeName === 'string' && isRecord(value.props);

const localChoice = (
  value: unknown,
  description: string,
): OpenUIJevValueChoice => ({
  value,
  description,
  rank: -1,
  explicit: true,
});

/** Compose the native OpenUI library and serialize with lang-core, never through A2UI. */
export async function composeJevOpenUI(
  options: OpenUIJevOptions,
): Promise<string> {
  const library = createOpenUiPromptLibrary({
    ...(options.promptRoot === undefined ? {} : { root: options.promptRoot }),
    ...(options.promptComponentNames === undefined
      ? {}
      : { componentNames: options.promptComponentNames }),
  });
  const { schema, specs, byName } = buildOpenUIJevCatalog(library);
  const parser = createParser(schema, library.root);
  const call = createJevDecisionRunner(options);
  // The action label is design intent; raw form values/params are not model input.
  const requests = [
    ...(options.conversation?.history ?? []),
    ...options.messages,
  ]
    .filter(message => message.role === 'user').slice(-10)
    .map(message => message.content.split('\n\nOpenUI action context:')[0]!);
  let currentData = { ...options.conversation?.dataModel };
  const actionText = options.messages.findLast(message =>
    message.role === 'user'
  )?.content.split('\n\nOpenUI action context:')[1];
  if (actionText) {
    try {
      const action: unknown = JSON.parse(actionText);
      if (isRecord(action) && isRecord(action.formState)) {
        currentData = { ...currentData, ...action.formState };
      }
    } catch {
      throw new Error('Invalid OpenUI action context.');
    }
  }
  const nodes = new Map<string, Node>();
  const reserved = new Set<string>();
  let nextId = 1;
  const freshId = () => {
    while (reserved.has(`jev_${nextId}`)) nextId++;
    const id = `jev_${nextId++}`;
    reserved.add(id);
    return id;
  };
  let previous = '';
  let declarations: Record<string, unknown> = {};
  const latest = [...(options.conversation?.history ?? []), ...options.messages]
    .findLast(message =>
      message.role === 'assistant' && message.content.trim()
    );
  if (latest) {
    const parsed = parser.parse(latest.content);
    if (
      !parsed.root || parsed.meta.incomplete || parsed.meta.errors.length > 0
      || parsed.meta.unresolved.length > 0
    ) {
      throw new Error(
        'The previous OpenUI program is not valid for the active library.',
      );
    }
    previous = latest.content;
    for (const statement of split(tokenize(previous))) {
      reserved.add(statement.id);
      reserved.add(statement.id.replace(/^\$/, ''));
    }
    declarations = { ...parsed.stateDeclarations };
    const reserve = (value: unknown) => {
      if (element(value) && value.statementId) reserved.add(value.statementId);
      if (Array.isArray(value)) value.forEach(item => reserve(item));
      else if (isRecord(value)) {
        Object.values(value).forEach(item => reserve(item));
      }
    };
    reserve(parsed.root);
    const read = (value: ElementNode, root = false): string => {
      const id = root ? 'root' : value.statementId ?? freshId();
      if (nodes.has(id)) {
        throw new Error(
          'Jev requires each OpenUI component to have one parent.',
        );
      }
      const spec = byName.get(value.typeName)!;
      const props = structuredClone(value.props);
      const tree: JevComponent = { id, component: value.typeName };
      nodes.set(id, { tree, props });
      if (spec.shape === 'children' || spec.shape === 'buttons') {
        let key = 'children';
        if (spec.shape === 'buttons') key = 'buttons';
        else if (
          !Array.isArray(props.children) && Array.isArray(props.items)
          && spec.name === 'List'
        ) key = 'items';
        if (Array.isArray(props[key])) {
          tree.children = (props[key] as unknown[]).map(child => {
            if (!element(child)) {
              throw new Error('OpenUI layout children must be components.');
            }
            return read(child);
          });
          delete props[key];
        }
      } else if (spec.shape === 'modal') {
        for (const key of ['trigger', 'content']) {
          if (!element(props[key])) {
            throw new Error('OpenUI Modal slots must be components.');
          }
          tree[key] = read(props[key]);
          delete props[key];
        }
      } else if (spec.shape === 'tabs') {
        tree.tabs = (props.tabs as Record<string, unknown>[]).map(tab => {
          if (!element(tab.child)) {
            throw new Error('OpenUI tab content must be a component.');
          }
          return { ...tab, child: read(tab.child) };
        });
        delete props.tabs;
      }
      return id;
    };
    read(parsed.root, true);
    // Values stay local and are restored in DSL; only names/types enter candidates.
    for (const key of Object.keys(declarations)) {
      if (!Object.hasOwn(currentData, key)) continue;
      const field = currentData[key];
      declarations[key] = isRecord(field) && Object.hasOwn(field, 'value')
        ? field.value
        : field;
    }
  }
  const describe = () =>
    describeJevComponents(
      [...nodes.values()].map(({ tree, props }) => ({
        ...tree,
        ...Object.fromEntries(
          ['text', 'label', 'title', 'variant'].filter(key =>
            typeof props[key] === 'string'
          ).map(key => [key, props[key]]),
        ),
      })),
    )
      .map(item => ({
        ...item,
        ...(item.component.component === 'Buttons'
          ? { allowedChildren: ['Button'] }
          : {}),
      }));
  const existing = nodes.size > 0 ? describe() : [];
  const existingIds = new Set(nodes.keys());
  const { choices, available } = buildOpenUIJevCandidates(
    specs,
    requests,
    declarations,
  );
  const rootSpec = byName.get(library.root ?? 'Stack');
  if (!rootSpec || rootSpec.shape !== 'children') {
    throw new Error('Jev OpenUI requires a root with component children.');
  }
  const context = {
    ...createJevCompositionContext(
      requests,
      'Compose the currently visible OpenUI interface from its native library and supplied content. Do not duplicate future workflow steps. Preserve existing state and layout unless changes are requested. Values absent from choices cannot be invented. No image search, generation, external tool or other model is available. Do not claim external actions occurred. Loading is only for an explicitly requested loading preview. New buttons request an assistant UI update.',
      options.enableDesignGuidance,
    ),
    ...(options.systemAppendix
      ? { host_instructions: options.systemAppendix }
      : {}),
    existing_elements: existing.map(({ id, description, parent }) => ({
      id,
      description,
      parent,
    })),
  };
  const first = createJevComponentQuestions(existing, available);
  const selection = await call(context, first, 'components');
  const { removed } = createJevRetention(existing, selection);
  const remove = (id: string) => {
    for (const child of jevChildIds(nodes.get(id)!.tree)) remove(child);
    nodes.delete(id);
  };
  for (const id of removed) if (nodes.has(id)) remove(id);
  for (const { tree } of nodes.values()) {
    if (Array.isArray(tree.children)) {
      tree.children = tree.children.filter(id => nodes.has(String(id)));
    }
  }
  const create = (name: string, id = freshId()): Node => {
    const spec = byName.get(name);
    if (!spec) {
      throw new Error(
        `OpenUI library is missing a required slot component: ${name}.`,
      );
    }
    const node: Node = { tree: { id, component: name }, props: {} };
    nodes.set(id, node);
    if (nodes.size > JEV_MAX_COMPONENTS) {
      throw new Error('Jev composition exceeds the 64-component limit.');
    }
    if (spec.shape === 'children' || spec.shape === 'buttons') {
      node.tree.children = [];
    }
    if (spec.shape === 'modal') {
      node.tree.trigger = create('Button').tree.id;
      node.tree.content = create(rootSpec.name).tree.id;
    }
    if (spec.shape === 'tabs') {
      node.tree.tabs = Array.from(
        { length: 2 },
        (_, index) => ({
          value: `tab_${index + 1}`,
          title: '',
          child: create(rootSpec.name).tree.id,
        }),
      );
    }
    return node;
  };
  if (!nodes.has('root')) create(rootSpec.name, 'root');
  let staging = [...nodes.values()].find(node =>
    Array.isArray(node.tree.children) && node.tree.component !== 'Buttons'
  );
  if (
    !staging
    && available.some(spec => Number(selection[`add_${spec.name}`]) > 0)
  ) {
    const previousRoot = nodes.get('root')!;
    const id = freshId();
    previousRoot.tree.id = id;
    nodes.delete('root');
    nodes.set(id, previousRoot);
    existingIds.delete('root');
    existingIds.add(id);
    selection[`keep_${id}`] = selection.keep_root ?? 'preserve_layout';
    delete selection.keep_root;
    staging = create(rootSpec.name, 'root');
    staging.tree.children = [id];
  }
  for (const spec of available) {
    for (
      let index = 0;
      index < Number(selection[`add_${spec.name}`]);
      index++
    ) (staging!.tree.children as string[]).push(create(spec.name).tree.id);
  }
  const tree = describe();
  const retention = createJevRetention(tree, selection, existingIds);
  const propertyPlan = createJevPropertyQuestions();
  const { questions: properties, offer } = propertyPlan;
  for (const node of nodes.values()) {
    const { id, component } = node.tree;
    const spec = byName.get(component)!;
    const preserve = retention.preservesProperties(id);
    for (const prop of spec.props) {
      if (
        JEV_STRUCTURAL_PROPS.has(prop.name)
        || spec.name === 'List' && prop.name === 'items'
      ) continue;
      if (
        prop.name === 'action'
        || prop.name === 'name'
          && spec.props.some(item => item.name === 'value')
      ) continue;
      if (
        prop.name === 'value' && spec.props.some(item => item.name === 'name')
      ) continue;
      if (preserve) continue;
      const candidates = choices(prop, spec.name);
      const current = node.props[prop.name];
      if (existingIds.has(id) && current !== undefined) {
        if (
          prop.name !== 'url' || isOpenUIJevMediaURL(current)
          || isASTNode(current)
        ) {
          candidates.unshift(
            localChoice(current, 'Keep the existing property unchanged.'),
          );
        }
      } else if (!prop.required) {
        candidates.unshift(
          localChoice(
            undefined,
            'Use the component default (omit this property).',
          ),
        );
      }
      if (
        !prop.required && current === undefined
        && candidates.every(item =>
          item.placeholder === true || item.value === undefined
        )
      ) continue;
      offer(
        `prop_${id}_${prop.name}`,
        `${id} ${spec.name}.${prop.name}: select content/style for this node without duplicating other copy targets.`,
        candidates,
        value => {
          if (value === undefined) delete node.props[prop.name];
          else node.props[prop.name] = structuredClone(value);
        },
      );
    }
    if (spec.shape === 'tabs' && !existingIds.has(id)) {
      for (
        const [index, tab] of (node.tree.tabs as Record<string, unknown>[])
          .entries()
      ) {
        offer(
          `tab_${id}_${index}`,
          `Choose the title for tab ${index + 1} of ${id}.`,
          choices(
            { name: 'title', required: true, schema: { type: 'string' } },
            'Tabs',
          ),
          value => {
            tab.title = value;
          },
        );
      }
    }
  }
  const propertyState = {
    ...context,
    selected_elements: tree.map(({ id, description, parent }) => ({
      id,
      description,
      parent,
    })),
    copy_targets: propertyPlan.ids().filter(id =>
      /_(?:text|label|title|subtitle)$/.test(id)
    ).map((id, index) => ({ id, ordinal: index + 1 })),
  };
  const answers = await call(propertyState, properties, 'properties');
  propertyPlan.apply(answers);
  for (const { tree, props } of nodes.values()) {
    const spec = byName.get(tree.component)!;
    if (
      !existingIds.has(tree.id) && spec.props.some(prop =>
        prop.name === 'action'
      ) && tree.component === 'Button'
    ) {
      props.action = {
        k: 'Comp',
        name: 'Action',
        args: [{
          k: 'Arr',
          els: [{
            k: 'Comp',
            name: 'ToAssistant',
            args: [
              isASTNode(props.label)
                ? props.label
                : { k: 'Str', v: props.label },
            ],
          }],
        }],
      };
    }
    if (
      spec.props.some(prop => prop.name === 'name')
      && spec.props.some(prop => prop.name === 'value')
    ) {
      if (existingIds.has(tree.id)) {
        const name = props.name;
        const value = typeof name === 'string'
          ? currentData[name]
          : undefined;
        if (value !== undefined && !isASTNode(props.value)) {
          props.value = isRecord(value) && Object.hasOwn(value, 'value')
            ? value.value
            : value;
        }
      } else {
        const name = `$${tree.id}`;
        const valueSchema = spec.props.find(prop =>
          prop.name === 'value'
        )!.schema;
        declarations[name] = valueSchema.type === 'boolean'
          ? false
          : (valueSchema.type === 'number'
            ? 0
            : '');
        props.name = name;
        props.value = { k: 'StateRef', n: name };
      }
    }
  }
  const arranged = await arrangeJevLayout(
    describe(),
    context,
    call,
    retention.layout,
    existingIds,
  );
  for (const [id, children] of arranged.children) {
    nodes.get(id)!.tree.children = children;
  }
  // Siblings with the same visible text are duplicates regardless of component type or variant.
  for (const { tree } of nodes.values()) {
    if (!Array.isArray(tree.children)) continue;
    const seen = new Set<string>();
    for (const id of tree.children as string[]) {
      const node = nodes.get(id)!;
      if (
        !['Text', 'TextContent'].includes(node.tree.component)
        || typeof node.props.text !== 'string'
      ) continue;
      const text = node.props.text;
      if (existingIds.has(id) || !seen.has(text)) {
        seen.add(text);
        continue;
      }
      const key = `prop_${id}_text`;
      const candidates = propertyPlan.choices(key).filter(item =>
        typeof item.value === 'string' && !seen.has(item.value)
      );
      candidates.push(localChoice(undefined, 'Omit this duplicate text.'));
      const answer = await call({ ...propertyState, copy_conflict: id }, {
        [key]: question(
          'Choose unused copy for this duplicate sibling, or omit it.',
          Object.fromEntries(
            candidates.map((item, index) => [String(index), item.description]),
          ),
        ),
      }, 'copy');
      const value = candidates[Number(answer[key])]!.value;
      if (value === undefined) {
        tree.children = (tree.children as string[]).filter(child =>
          child !== id
        );
        nodes.delete(id);
      } else {
        node.props.text = value;
        seen.add(value as string);
      }
    }
  }
  const build = (id: string): ElementNode => {
    const { tree, props } = nodes.get(id)!;
    const spec = byName.get(tree.component)!;
    const result = { ...props };
    if (Array.isArray(tree.children)) {
      result[spec.shape === 'buttons' ? 'buttons' : 'children'] =
        (tree.children as string[]).map(id => build(id));
    }
    if (spec.shape === 'modal') {
      result.trigger = build(String(tree.trigger));
      result.content = build(String(tree.content));
    }
    if (Array.isArray(tree.tabs)) {
      result.tabs = (tree.tabs as Record<string, unknown>[]).map(tab => ({
        ...tab,
        child: build(String(tab.child)),
      }));
    }
    return {
      type: 'element',
      typeName: tree.component,
      statementId: id,
      props: result,
      partial: false,
    };
  };
  describe();
  if (
    nodes.size === 1 && Array.isArray(nodes.get('root')!.tree.children)
    && (nodes.get('root')!.tree.children as unknown[]).length === 0
  ) throw new Error('Jev selected no visible content for this request.');
  const output = jsonToOpenUI(build('root'), library, {
    stateDeclarations: declarations,
  }) + Object.entries(declarations).filter(([, value]) =>
    value === null
  ).map(([key]) =>
    `\n${key} = null`
  ).join('');
  // Preserve referenced queries/mutations and runtime expressions from an existing program.
  const text = previous ? mergeStatements(previous, output) : output;
  const result = parser.parse(text);
  if (
    !result.root || result.meta.incomplete || result.meta.errors.length > 0
    || result.meta.unresolved.length > 0
  ) throw new Error('Invalid Jev OpenUI composition.');
  options.signal.throwIfAborted();
  return text;
}
