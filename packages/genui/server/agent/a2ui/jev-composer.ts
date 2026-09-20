// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { isDeepStrictEqual } from 'node:util';

import type { A2UICatalog } from './a2ui-catalog.js';
import { A2UIMessageArray, validateA2UIOutput } from './a2ui-validator.js';
import type { A2UIMessage, ValidationOptions } from './a2ui-validator.js';
import {
  JEV_CHILD_PROPS,
  JEV_MCP_APP_RESOURCE_PROPS,
  buildJevCandidates,
  describeJevTree,
  isRecord,
  jevChildIds,
  jevShape,
  readJevContent,
} from './jev-candidates.js';
import type {
  HostedMcpAppResource,
  JevComponent,
  JevContent,
  JevValueChoice,
} from './jev-candidates.js';
import { arrangeJevLayout } from './jev-layout.js';
import type { JevLayoutMode } from './jev-layout.js';
import { cleanJevSnapshot, omitUnhostedJevMcpApps } from './jev-output.js';
import { GENUI_DESIGN_GUIDANCE } from '../../design/design-guidance.js';
import type {
  ChatMessage,
  ConversationContext,
} from '../../service/common/types.js';
import { evaluateJevQuestions } from '../common/jev-evaluator.js';
import type {
  JevEvaluationPhase,
  JevEvaluator,
  JevQuestion,
} from '../common/jev-evaluator.js';

export interface JevCompositionOptions {
  messages: ChatMessage[];
  conversation?: ConversationContext | undefined;
  catalog: A2UICatalog;
  evaluate: JevEvaluator;
  signal: AbortSignal;
  onUsage: (usage: unknown) => void;
  enableDesignGuidance?: boolean | undefined;
  validationOptions?: ValidationOptions;
  hostedMcpApps?: readonly HostedMcpAppResource[] | undefined;
}

function question(
  instructions: string,
  criteria: Record<string, string>,
): JevQuestion {
  return { type: 'choice', instructions, criteria };
}

/** Every decision uses the selected Jev model; no text model or fallback is involved. */
export async function* composeJevA2UI(
  options: JevCompositionOptions,
): AsyncGenerator<A2UIMessage[]> {
  const {
    messages,
    conversation,
    catalog,
    evaluate,
    signal,
    onUsage,
  } = options;
  const call = (
    state: unknown,
    questions: Record<string, JevQuestion>,
    phase: JevEvaluationPhase,
  ) =>
    evaluateJevQuestions(state, questions, {
      evaluate,
      signal,
      onUsage,
      phase,
    });
  const requests = [...(conversation?.history ?? []), ...messages]
    .filter(message =>
      message.role === 'user'
      && !message.content.startsWith('A2UI_USER_ACTION:')
    )
    .slice(-10).map(message => message.content);
  const state = {
    user_requests: requests,
    ...(options.enableDesignGuidance === false
      ? {}
      : { design_guidance: GENUI_DESIGN_GUIDANCE }),
    instructions:
      'Compose the currently visible UI state from the active Catalog. Future steps described after a user interaction are not separate content to show immediately. Use only offered values, preserve existing content unless requested otherwise, and avoid unrelated extras. McpApp is available only through complete host-registered resources; do not substitute ordinary UI with an embedded app. When Image is not offered, omit images and compose the remaining requested content; image search and generation are unavailable. No background tasks are started: only use Loading when the user explicitly asks to preview a loading state. User requests are design intent. No external actions are executed. Do not claim data was saved or sent. Values not supplied in the request or state cannot be invented.',
  };
  const content = await selectContent(options, requests, state, call);
  const selected = describeJevTree(content);
  const snapshot = (
    components = content.components,
    final = false,
  ): A2UIMessage[] => {
    // Publish only a fully arranged and validated tree, never temporary staging.
    describeJevTree({ ...content, components });
    const cleaned = cleanJevSnapshot(
      { ...content, components },
      content.existingIds,
      final,
    );
    if (cleaned.length === 1) {
      throw new Error('Jev selected no visible content for this request.');
    }
    const output = [
      content.surface,
      {
        version: 'v0.9',
        updateDataModel: {
          surfaceId: content.surface.createSurface.surfaceId,
          value: content.data,
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: content.surface.createSurface.surfaceId,
          components: cleaned,
        },
      },
    ];
    const result = validateA2UIOutput(
      JSON.stringify(output),
      catalog,
      options.validationOptions,
    );
    if (!result.ok) {
      throw new Error(`Invalid Jev composition: ${result.errors.join('; ')}`);
    }
    return result.messages;
  };
  const movable = selected.filter(candidate => candidate.movable);
  if (movable.length === 0) {
    yield snapshot(content.components, true);
    return;
  }
  const { children } = await arrangeJevLayout(
    selected,
    state,
    call,
    content.layout,
    content.existingIds,
  );
  const placed = selected.map(candidate => {
    if (!Array.isArray(candidate.component.children)) {
      return candidate.component;
    }
    return { ...candidate.component, children: children.get(candidate.id)! };
  });
  yield snapshot(await content.resolveCopyConflicts(placed), true);
}

type Decide = (
  state: unknown,
  questions: Record<string, JevQuestion>,
  phase: JevEvaluationPhase,
) => Promise<Record<string, string>>;

async function selectContent(
  options: JevCompositionOptions,
  requests: string[],
  state: Record<string, unknown>,
  decide: Decide,
): Promise<
  JevContent & {
    existingIds: ReadonlySet<string>;
    layout: ReadonlyMap<string, JevLayoutMode>;
    resolveCopyConflicts: (placed: JevComponent[]) => Promise<JevComponent[]>;
  }
> {
  let previous: JevContent | undefined;
  for (
    const message of [
      ...(options.conversation?.history ?? []),
      ...options.messages,
    ]
  ) {
    if (message.role !== 'assistant') continue;
    let json: unknown;
    try {
      json = JSON.parse(message.content);
    } catch {
      continue;
    }
    const parsed = A2UIMessageArray.safeParse(json);
    if (parsed.success && parsed.data.some(item => 'createSurface' in item)) {
      previous = readJevContent(parsed.data);
    }
  }
  const data = structuredClone(
    options.conversation?.dataModel ?? previous?.data ?? {},
  );
  const source = buildJevCandidates(
    options.catalog,
    requests,
    data,
    options.validationOptions?.isImageSourceAllowed,
    options.hostedMcpApps,
  );
  if (previous && source.mcpApps.length === 0) {
    previous = omitUnhostedJevMcpApps(previous);
  }
  // A retained component can have valid properties absent from the new-content choices.
  const byName = new Map(
    options.catalog.components.map(spec => [spec.name, spec]),
  );
  const containers = source.specs.filter(spec => jevShape(spec) === 'children');
  if (containers.length === 0) {
    throw new Error('This Catalog has no available root container.');
  }
  const existing = previous ? describeJevTree(previous) : [];
  const existingIds = new Set(existing.map(item => item.id));
  const existingById = new Map(existing.map(item => [item.id, item]));
  const first: Record<string, JevQuestion> = {
    root: question(
      'Choose the root layout, or unavailable if the offered content cannot fulfill the request.',
      {
        ...Object.fromEntries(
          containers.map(spec => [spec.name, spec.summary]),
        ),
        ...(previous
          ? {
            keep: 'Keep the existing root and reconsider its properties.',
            preserve:
              'Keep the existing root and its optional properties/defaults unchanged. Choose only when the request and design guidance need no changes to those properties. Required content is still evaluated.',
          }
          : {}),
        unavailable:
          'Cannot fulfill the request with this Catalog and the supplied content.',
      },
    ),
  };
  for (const candidate of existing.filter(item => item.movable)) {
    first[`keep_${candidate.id}`] = question(
      `Existing ${candidate.description}`,
      {
        keep: 'Keep; reconsider parent, sibling position and properties.',
        preserve:
          'Keep optional properties/defaults; reconsider parent and sibling position.',
        keep_layout:
          'Keep parent and relative sibling order; reconsider properties.',
        preserve_layout:
          'Keep parent, relative sibling order and optional properties/defaults.',
        reorder: 'Keep parent; reconsider sibling position and properties.',
        reorder_preserve:
          'Keep parent and optional properties/defaults; reconsider sibling position.',
        omit: 'Remove this subtree.',
      },
    );
  }
  for (const spec of source.specs) {
    first[`add_${spec.name}`] = question(
      `How many NEW standalone ${spec.name} components are needed in the currently visible state? ${spec.summary} Existing components are retained separately. Compound children such as Button labels, Modal triggers and content containers are created automatically; do not count them again. Do not add future workflow steps or redundant copies.`,
      Object.fromEntries(
        Array.from(
          { length: 9 },
          (_, count) => [String(count), `${count} new components`],
        ),
      ),
    );
  }
  const actionRequest = options.messages.filter(message =>
    message.role === 'user'
  )
    .at(-1)?.content;
  let action: { name: string } | undefined;
  if (actionRequest?.startsWith('A2UI_USER_ACTION:')) {
    const event: unknown = JSON.parse(
      actionRequest.slice('A2UI_USER_ACTION:'.length),
    );
    if (
      !isRecord(event) || !isRecord(event.action)
      || typeof event.action.name !== 'string'
      || event.surfaceId !== previous?.surface.createSurface.surfaceId
      || !existing.some(item =>
        isRecord(item.component.action)
        && isRecord(item.component.action.event)
        && item.component.action.event.name
          === (event.action as Record<string, unknown>).name
      )
    ) {
      throw new Error('This action is not present in the current Jev surface.');
    }
    action = { name: event.action.name };
  }
  const context = {
    ...state,
    retention_instructions:
      'For existing nodes, retain the parent and relative sibling order unless the request requires movement. Prefer keep_layout for content/style edits and preserve_layout when optional properties also stay unchanged. Use reorder or reorder_preserve for order-only changes; keep or preserve allow reparenting. Movable descendants decide independently. Optional-property preservation includes fixed children; required content and host resources are still evaluated. New nodes can be inserted without reordering unchanged siblings.',
    hosted_mcp_apps: source.mcpApps.map(({ uri, title }) => ({ uri, title })),
    existing_elements: existing.map(({ id, description, parent }) => {
      const siblings = parent === undefined
        ? undefined
        : existingById.get(parent)!.component.children;
      return {
        id,
        description,
        parent,
        existing_position: Array.isArray(siblings)
          ? siblings.indexOf(id)
          : undefined,
      };
    }),
    ...(action ? { user_action: action } : {}),
  };
  const selected = await decide(context, first, 'components');
  if (selected.root === 'unavailable') {
    throw new Error(
      'Jev cannot compose this request with the available Catalog and supplied content.',
    );
  }
  const removed = new Set(
    existing.filter(item => selected[`keep_${item.id}`] === 'omit').map(item =>
      item.id
    ),
  );
  for (const item of existing) {
    let current = item;
    while (current.parent) {
      if (removed.has(current.parent)) removed.add(item.id);
      current = existing.find(parent => parent.id === current.parent)!;
    }
  }
  const components = existing.filter(item => !removed.has(item.id)).map(
    item => {
      const component = structuredClone(item.component);
      if (Array.isArray(component.children)) {
        component.children = component.children.filter(id =>
          !removed.has(String(id))
        );
      }
      return component;
    },
  );
  let root = components.find(component => component.id === 'root');
  if (
    root && !['keep', 'preserve'].includes(selected.root!)
    && root.component !== selected.root
  ) {
    if (!Array.isArray(root.children)) {
      throw new Error(
        'Keep the existing compound root when editing this surface.',
      );
    }
    root = { id: 'root', component: selected.root!, children: root.children };
    components[components.findIndex(component => component.id === 'root')] =
      root;
  }
  if (!root) {
    root = { id: 'root', component: selected.root!, children: [] };
    components.push(root);
  }
  const anchor = Array.isArray(root.children)
    ? root
    : components.find(component => Array.isArray(component.children));
  const properties: Record<string, JevQuestion> = {};
  const apply = new Map<string, (choice: string) => void>();
  const offer = (
    id: string,
    instructions: string,
    choices: JevValueChoice[],
    set: (value: unknown) => void,
  ) => {
    choices = choices.filter((choice, index) =>
      !choices.slice(0, index).some(other =>
        isDeepStrictEqual(other.value, choice.value)
      )
    );
    if (choices.length === 0) {
      throw new Error(`No supplied values are available for ${instructions}.`);
    }
    properties[id] = question(
      instructions,
      Object.fromEntries(
        choices.map((choice, index) => [String(index), choice.description]),
      ),
    );
    apply.set(id, choice => set(choices[Number(choice)]!.value));
    return choices;
  };
  let serial = 0;
  const create = (name: string): JevComponent => {
    let id: string;
    do {
      id = `jev-${++serial}`;
    } while (
      existingIds.has(id) || components.some(component => component.id === id)
    );
    if (components.length >= 64) {
      throw new Error('Jev composition exceeds the 64-component limit.');
    }
    const spec = byName.get(name);
    if (!spec) {
      throw new Error(
        `The Catalog cannot supply ${name} for a compound component.`,
      );
    }
    const component: JevComponent = { id, component: name };
    components.push(component);
    const shape = jevShape(spec);
    const textType = source.specs.find(item => item.name === 'Text')?.name;
    const childType = containers[0]!.name;
    if (shape === 'children') component.children = [];
    if (shape === 'child') {
      component.child =
        create(spec.requiresAction ? textType ?? childType : childType).id;
    }
    if (shape === 'trigger-content') {
      component.trigger = create(textType ?? childType).id;
      component.content = create(childType).id;
    }
    if (shape === 'tabs') {
      component.tabs = Array.from({ length: 2 }, (_, index) => {
        const tab = { title: '', child: create(childType).id };
        offer(
          `prop_${id}_tab_${index}`,
          `Title of tab ${index + 1} in ${id}`,
          source.choices({ name: 'title', type: 'string' }),
          value => {
            tab.title = String(value);
          },
        );
        return tab;
      });
    }
    return component;
  };
  for (const spec of source.specs) {
    const count = Number(selected[`add_${spec.name}`]);
    for (let index = 0; index < count; index++) {
      if (!anchor || !Array.isArray(anchor.children)) {
        throw new Error(
          'The existing surface has no container for new content.',
        );
      }
      anchor.children.push(create(spec.name).id);
    }
  }
  if (components.length === 1) {
    throw new Error('Jev selected no content for this request.');
  }
  const oldById = new Map(
    previous?.components.map(component => [component.id, component]),
  );
  const preservesOptionalProperties = (id: string) => {
    let item = existingById.get(id);
    while (item && !item.movable && item.parent !== undefined) {
      item = existingById.get(item.parent);
    }
    return item
      && ['preserve', 'preserve_layout', 'reorder_preserve'].includes(
        selected[item.id === 'root' ? 'root' : `keep_${item.id}`]!,
      );
  };
  const copyQuestions: {
    id: string;
    component: JevComponent;
    question: JevQuestion;
    choices: JevValueChoice[];
  }[] = [];
  for (const component of components) {
    const spec = byName.get(component.component);
    if (!spec) {
      throw new Error(
        `The active Catalog does not support ${component.component}.`,
      );
    }
    if (component.component === 'McpApp') {
      offer(
        `resource_${component.id}`,
        'Choose a complete host-registered MCP App resource. Bundle URLs and renderer data stay together.',
        source.mcpApps.map(resource => ({
          value: resource,
          description: `${resource.title} (${resource.uri})`,
        })),
        value => {
          const resource = value as HostedMcpAppResource;
          component.url = resource.url;
          component.mcpAppData = structuredClone(resource.mcpAppData);
          if (resource.webUrl === undefined) delete component.webUrl;
          else component.webUrl = resource.webUrl;
        },
      );
    }
    for (const prop of spec.props) {
      if (JEV_CHILD_PROPS.has(prop.name)) continue;
      if (
        component.component === 'McpApp'
        && JEV_MCP_APP_RESOURCE_PROPS.has(prop.name)
      ) continue;
      const old = oldById.get(component.id);
      if (
        old?.component === component.component && !prop.required
        && preservesOptionalProperties(component.id)
      ) continue;
      if (prop.name === 'action' && !old) {
        component.action = { event: { name: component.id } };
        continue;
      }
      // Keep live input bindings/values private and stable. New controls get local state.
      if (
        prop.name === 'value'
        && prop.schema?.oneOf?.some(branch => branch.properties?.path)
      ) {
        if (old && Object.hasOwn(old, 'value')) continue;
        const path = `/jev-input-${component.id}`;
        const options = source.choices(prop);
        const initial = options.find(choice => !isRecord(choice.value))?.value
          ?? '';
        let empty: unknown = '';
        if (typeof initial === 'boolean') empty = false;
        if (typeof initial === 'number') empty = 0;
        if (Array.isArray(initial)) empty = [];
        data[path.slice(1)] = empty;
        component.value = { path };
        continue;
      }
      const choices = source.choices(prop, component.component);
      // Synthetic empty strings/arrays/objects carry no supplied intent. For an
      // optional property with no alternatives, retain its omission and use the renderer default.
      if (
        !prop.required && !Object.hasOwn(component, prop.name)
        && choices.every(choice => choice.placeholder)
      ) continue;
      if (old && Object.hasOwn(old, prop.name)) {
        choices.unshift({
          value: old[prop.name],
          description: 'Keep the existing property unchanged.',
        });
      } else if (!prop.required) {
        choices.unshift({
          value: undefined,
          description: 'Use the component default (omit this property).',
        });
      }
      if (choices.length === 0) {
        if (prop.required) {
          throw new Error(
            `Missing supplied content for ${component.component}.${prop.name}.`,
          );
        }
        continue;
      }
      const offeredChoices = offer(
        `prop_${component.id}_${prop.name}`,
        `${component.id} ${component.component}.${prop.name}: ${
          prop.description ?? prop.type
        }`,
        choices,
        value => {
          if (value === undefined) delete component[prop.name];
          else component[prop.name] = structuredClone(value);
        },
      );
      if (!old && component.component === 'Text' && prop.name === 'text') {
        const id = `prop_${component.id}_${prop.name}`;
        copyQuestions.push({
          id,
          component,
          question: properties[id]!,
          choices: offeredChoices,
        });
        delete properties[id];
      }
    }
  }
  const propertyState = () => ({
    ...context,
    selected_elements: components.map(component => {
      const owner = components.find(item =>
        jevChildIds(item).includes(component.id)
      );
      return {
        id: component.id,
        component: component.component,
        parent: owner?.id,
        children: jevChildIds(component),
        ...(typeof component.variant === 'string'
          ? { variant: component.variant }
          : {}),
      };
    }),
    assigned_copy: components.flatMap(component => {
      const text = component.text;
      return component.component === 'Text'
          && (typeof text === 'string'
            || (isRecord(text) && typeof text.path === 'string'))
        ? [{
          id: component.id,
          text: typeof text === 'string' ? text : { path: text.path },
        }]
        : [];
    }),
  });
  const describeCopyTargets = () =>
    copyQuestions.map((item, index) => {
      const owner = components.find(component =>
        jevChildIds(component).includes(item.component.id)
      );
      const role = owner && byName.get(owner.component)?.requiresAction
        ? 'action_label'
        : (owner?.trigger === item.component.id
          ? 'trigger_label'
          : 'display_content');
      return {
        id: item.component.id,
        role,
        owner: owner ? { id: owner.id, component: owner.component } : undefined,
        ordinal: index + 1,
        total: copyQuestions.length,
      };
    });
  const copyTargets = describeCopyTargets();
  // All copy slots are visible to every batch, including slots in other 32-question batches.
  for (const [index, item] of copyQuestions.entries()) {
    const target = copyTargets[index]!;
    const peers = copyTargets.filter(peer =>
      peer.role === target.role && peer.owner?.id === target.owner?.id
    );
    properties[item.id] = {
      ...item.question,
      instructions: `${item.question.instructions} Role: ${target.role}; slot ${
        peers.indexOf(target) + 1
      } of ${peers.length} for this role and owner. See copy_targets for the full plan. Cover a distinct part of the requested information in request order. Display content must not repeat action labels or other display slots. Keep workflow instructions and future steps out of visible copy.`,
    };
  }
  const answers = await decide(
    {
      ...propertyState(),
      copy_targets: copyTargets,
    },
    properties,
    copyQuestions.length > 0 ? 'copy' : 'properties',
  );
  for (const [id, choice] of Object.entries(answers)) apply.get(id)!(choice);
  const content = {
    existingIds,
    layout: new Map<string, JevLayoutMode>(
      existing.filter(item => item.movable && !removed.has(item.id)).map(
        item => {
          const policy = selected[`keep_${item.id}`];
          return [
            item.id,
            policy === 'keep_layout' || policy === 'preserve_layout'
              ? 'keep'
              : (policy === 'reorder' || policy === 'reorder_preserve'
                ? 'reorder'
                : 'move'),
          ];
        },
      ),
    ),
    surface: previous?.surface
      ?? {
        version: 'v0.9' as const,
        createSurface: { surfaceId: 'main', catalogId: options.catalog.id },
      },
    data,
    components,
  };
  return {
    ...content,
    async resolveCopyConflicts(placed: JevComponent[]) {
      // Final parents distinguish legitimate repeated copy in different regions.
      components.splice(0, components.length, ...placed);
      const targets = describeCopyTargets();
      // Only nodes the existing cleanup would coalesce need another decision. Fixed labels,
      // bindings, existing text and differently styled/scoped copy are never reallocated here.
      const retained = new Set(
        cleanJevSnapshot(content, content.existingIds, false).map(item =>
          item.id
        ),
      );
      const omitted = new Set<string>();
      for (const [index, item] of copyQuestions.entries()) {
        if (retained.has(item.component.id)) continue;
        const used = new Set(
          components.flatMap(component =>
            component.component === 'Text' && typeof component.text === 'string'
              ? [component.text]
              : []
          ),
        );
        const criteria = Object.fromEntries(
          item.choices.flatMap((choice, choiceIndex) =>
            typeof choice.value === 'string'
              && (!choice.value.trim() || used.has(choice.value))
              ? []
              : [[String(choiceIndex), choice.description]]
          ),
        );
        criteria.omit =
          'Omit this redundant display node if all requested content is already covered.';
        const selection = await decide({
          ...propertyState(),
          copy_targets: targets,
          copy_target: targets[index],
          copy_conflict: true,
        }, {
          [item.id]: question(
            `${
              properties[item.id]!.instructions
            } This node duplicated another display node. Choose distinct remaining content or omit it.`,
            criteria,
          ),
        }, 'copy');
        if (selection[item.id] === 'omit') omitted.add(item.component.id);
        else apply.get(item.id)!(selection[item.id]!);
      }
      return components.filter(component => !omitted.has(component.id))
        .map(component =>
          Array.isArray(component.children)
            ? {
              ...component,
              children: component.children.filter(id =>
                !omitted.has(String(id))
              ),
            }
            : component
        );
    },
  };
}
