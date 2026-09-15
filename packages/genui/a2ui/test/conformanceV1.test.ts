// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { readFileSync, readdirSync } from 'node:fs';

import { describe, expect, test } from '@rstest/core';
import Ajv2020 from 'ajv/dist/2020.js';

import { createElement } from '@lynx-js/react';
import { act, renderHook } from '@lynx-js/react/testing-library';

import type { SerializedCatalog } from '../src/catalog/defineCatalog.js';
import {
  defineCatalog,
  resolveCatalog,
  serializeCatalog,
} from '../src/catalog/defineCatalog.js';
import { basicFunctions } from '../src/functions/index.js';
import { A2UIContext } from '../src/react/A2UIProvider.jsx';
import { useAction } from '../src/react/useAction.js';
import { evaluateChecks } from '../src/react/useChecks.js';
import { MessageProcessor } from '../src/store/MessageProcessor.js';
import { executeFunctionCall } from '../src/store/resolveFunctionCall.js';
import type {
  RendererToAgentMessage,
  ServerToClientMessage,
} from '../src/store/types.js';
import agentSchema from './fixtures/a2ui-v1/agent_to_renderer.json' with {
  type: 'json',
};
import catalogSchema from './fixtures/a2ui-v1/catalog_definition.json' with {
  type: 'json',
};
import commonSchema from './fixtures/a2ui-v1/common_types.json' with {
  type: 'json',
};
import rendererSchema from './fixtures/a2ui-v1/renderer_to_agent.json' with {
  type: 'json',
};

const catalog = JSON.parse(
  readFileSync(new URL('../dist/catalog.json', import.meta.url), 'utf8'),
) as SerializedCatalog & {
  components: Record<string, { properties: Record<string, { $ref?: string }> }>;
};

const localExamples = new URL(
  '../../playground/src/mock/basic/',
  import.meta.url,
);

test.each(readdirSync(localExamples).filter(name => name.endsWith('.json')))(
  'replays local example %s with v1.0 envelopes and the built-in catalog',
  (name) => {
    const messages = JSON.parse(
      readFileSync(new URL(name, localExamples), 'utf8'),
    ) as ServerToClientMessage[];
    const processor = new MessageProcessor();
    const errors: unknown[] = [];
    processor.onEvent(({ message, resolve }) => {
      if ('error' in message) errors.push(message);
      resolve([]);
    });
    for (const message of messages) {
      expect(message.version).toBe('v1.0');
      processor.processMessages([message]);
    }
    expect(errors).toEqual([]);
    expect(processor.getSurfaces().size).toBeGreaterThan(0);
    for (const surface of processor.getSurfaces().values()) {
      expect(surface.catalogId).toBe(catalog.catalogId);
      expect(surface.rootComponentId).toBe('root');
      expect(surface.components.has('root')).toBe(true);
    }
    if (name === 'recs.json') {
      const validate = schemaValidator().compile(agentSchema);
      for (const message of messages) {
        expect(validate(message), JSON.stringify(validate.errors)).toBe(true);
      }
      const surface = processor.getSurfaces().get('default')!;
      expect(surface.components.get('recs')?.['children']).toEqual([
        'recCard-1',
        'recCard-2',
        'recCard-3',
      ]);
      expect(surface.components.get('recCard-3-text')?.['text']).toContain(
        'Sea Breeze Kitchen',
      );
    }
  },
);

function Text() {
  return null;
}

const message = (component: unknown) => ({
  version: 'v1.0',
  updateComponents: { surfaceId: 's', components: [component] },
});

const regex = (pattern: string) => ({
  call: 'regex',
  args: { value: { path: '/input' }, pattern },
});

function schemaValidator(manifest = catalog) {
  const ajv = new Ajv2020({
    strict: false,
    validateFormats: false,
    allErrors: true,
  });
  ajv.addSchema(commonSchema);
  ajv.addSchema(manifest, 'https://a2ui.org/specification/v1_0/catalog.json');
  return ajv;
}

function setup() {
  const processor = new MessageProcessor();
  processor.registerCatalog('test', defineCatalog(basicFunctions));
  processor.processMessages([{
    version: 'v1.0',
    createSurface: {
      surfaceId: 's',
      catalogId: 'test',
      dataModel: {
        input: '',
        items: [{ label: 'A' }, { label: 'B' }],
        offset: 2,
      },
    },
  }]);
  return processor;
}

describe('official A2UI v1.0 conformance', () => {
  test('generated catalog satisfies the official catalog schema', () => {
    const validate = schemaValidator().compile(catalogSchema);
    expect(validate(catalog), JSON.stringify(validate.errors)).toBe(true);
    expect(catalog.catalogId).toBe(catalog.$id);
    for (const [name, schema] of Object.entries(catalog.components)) {
      expect(schema.properties['component']).toEqual({ const: name });
      expect(schema['required']).toContain('component');
    }
    expect(catalog.components['Button']!.properties['child']!.$ref).toContain(
      'ComponentId',
    );
    expect(catalog.components['Column']!.properties['children']!.$ref)
      .toContain(
        'ChildList',
      );
  });

  test('serialized catalog has a usable discriminator and union definitions', () => {
    const serialized = serializeCatalog(
      defineCatalog([
        [Text, { Text: catalog.components['Text']! }],
        ...basicFunctions,
      ]),
      catalog.catalogId,
    );
    const ajv = new Ajv2020({
      strict: false,
      validateFormats: false,
      allErrors: true,
    });
    ajv.addSchema(commonSchema);
    const validate = ajv.compile(catalogSchema);
    expect(validate(serialized), JSON.stringify(validate.errors)).toBe(true);
    expect(serialized.$defs['anyComponent']).toEqual({
      oneOf: [{ $ref: '#/components/Text' }],
    });
  });

  test('official agent schema validates generated component and child contracts', () => {
    const validate = schemaValidator().compile(agentSchema);
    expect(
      validate(
        message({ id: 'root', component: 'Column', children: ['text'] }),
      ),
      JSON.stringify(validate.errors),
    ).toBe(true);
    expect(
      validate(
        message({
          id: 'root',
          component: 'Column',
          children: [{ component: 'Text', text: 'inline' }],
        }),
      ),
    ).toBe(false);
    expect(
      validate(message({ id: 'root', component: 'Unknown', children: [] })),
    ).toBe(false);
  });

  test('all emitted lifecycle errors satisfy the renderer schema', () => {
    const processor = setup();
    const messages: RendererToAgentMessage[] = [];
    processor.onEvent(({ message, resolve }) => {
      messages.push(message as RendererToAgentMessage);
      resolve([]);
    });
    processor.processMessages([
      { version: 'v0.9', createSurface: { surfaceId: 'old' } },
      { version: 'v1.0', createSurface: { surfaceId: 's' } },
      {
        version: 'v1.0',
        updateComponents: { surfaceId: 'missing', components: [] },
      },
    ] as unknown as ServerToClientMessage[]);
    const validate = schemaValidator().compile(rendererSchema);
    expect(messages).toHaveLength(3);
    for (const message of messages) {
      expect(validate(message), JSON.stringify(validate.errors)).toBe(true);
    }
  });

  test.each([['ABC', true], ['1bc', false], ['', false]] as const)(
    'composes structured validators through AND/OR/NOT for %s',
    (input, ok) => {
      const processor = setup();
      const surface = processor.getOrCreateSurface('s');
      surface.store.update('/input', input);
      const condition = {
        call: 'and',
        args: {
          values: [
            { call: 'required', args: { value: { path: '/input' } } },
            {
              call: 'or',
              args: {
                values: [regex('^[A-Z]+$'), {
                  call: 'not',
                  args: { value: regex('.*') },
                }],
              },
            },
          ],
        },
      };
      expect(evaluateChecks(processor, [{ condition }], surface).ok).toBe(ok);
    },
  );

  test('resolves userMessage before emitting a schema-valid action', async () => {
    const processor = setup();
    const catalog = defineCatalog(basicFunctions);
    const events: RendererToAgentMessage[] = [];
    processor.onEvent(({ message, resolve }) => {
      events.push(message as RendererToAgentMessage);
      resolve([]);
    });
    const view = renderHook(
      () =>
        useAction({ id: 'button', surfaceId: 's', dataContext: '/items/1' }),
      {
        wrapper: ({ children }) =>
          createElement(A2UIContext.Provider, {
            value: { processor, catalog, catalogMap: resolveCatalog(catalog) },
            children,
          }),
      },
    );
    try {
      for (
        const userMessage of ['Literal', { path: 'label' }, {
          call: 'formatString',
          args: { value: 'Selected ${@index(offset: 1)}' },
        }]
      ) {
        await act(async () => {
          await view.result.current.sendAction({
            event: { name: 'select', userMessage },
          });
        });
      }
      expect(
        events.map(event =>
          'action' in event ? event.action.userMessage : undefined
        ),
      ).toEqual(['Literal', 'B', 'Selected 2']);
      const validate = schemaValidator().compile(rendererSchema);
      for (const event of events) {
        expect(validate(event), JSON.stringify(validate.errors)).toBe(true);
      }
    } finally {
      view.unmount();
    }
  });

  test('logical functions unwrap structured false values', () => {
    const processor = setup();
    const run = (call: string, args: Record<string, unknown>) =>
      executeFunctionCall(processor, { call, args }, 's');
    expect(run('and', { values: [{ valid: false }, { valid: true }] })).toBe(
      false,
    );
    expect(run('or', { values: [{ valid: false }, { valid: false }] })).toBe(
      false,
    );
    expect(run('not', { value: { valid: false } })).toBe(true);
  });

  test('formatString resolves system functions, nested calls, bindings and escapes', () => {
    const processor = setup();
    const format = (value: string, path = '/items/1') =>
      executeFunctionCall(
        processor,
        { call: 'formatString', args: { value } },
        's',
        path,
      );
    expect(format('Item ${@index(offset: 1)}: ${label}')).toBe('Item 2: B');
    expect(format('${@index(offset: ${/offset})}')).toBe('3');
    expect(format('${add(a: @index(), b: 2)}')).toBe('3');
    expect(format('\\${@index()} ${formatString(value: "literal @index()") }'))
      .toBe('${@index()} literal @index()');
    expect(format('${/items}')).toBe('[{"label":"A"},{"label":"B"}]');
  });
});
