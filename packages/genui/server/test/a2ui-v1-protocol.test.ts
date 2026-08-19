// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import { BASIC_CATALOG } from '../agent/a2ui-catalog.js';
import { A2UIProtocolMessageStreamParser } from '../agent/a2ui-stream-parser.js';
import { validateA2UIOutput } from '../agent/a2ui-validator.js';

function validate(messages: unknown[]) {
  return validateA2UIOutput(JSON.stringify(messages), BASIC_CATALOG);
}

function createSurface(overrides: Record<string, unknown> = {}) {
  return {
    version: 'v1.0',
    createSurface: {
      catalogId: BASIC_CATALOG.id,
      surfaceId: 'main',
      ...overrides,
    },
  };
}

describe('A2UI v1.0 core protocol', () => {
  test('validates a complete inline surface', () => {
    const result = validate([
      createSurface({
        components: [{
          component: 'Text',
          id: 'root',
          text: { path: '/title' },
        }],
        dataModel: { title: 'Hello' },
        metadata: {
          extensions: { com_lynx_trace_id: 'trace-1' },
        },
      }),
    ]);

    expect(result.ok).toBe(true);
    expect(result.messages).toHaveLength(1);
  });

  test('accepts a dynamic userMessage on a catalog action', () => {
    const result = validate([
      createSurface({
        components: [
          {
            action: {
              event: {
                name: 'refresh',
                userMessage: { path: '/message' },
              },
            },
            child: 'button_label',
            component: 'Button',
            id: 'root',
          },
          { component: 'Text', id: 'button_label', text: 'Refresh' },
        ],
        dataModel: { message: 'Refresh the card' },
      }),
    ]);

    expect(result.ok).toBe(true);
  });

  test('uses the v1.0 function-call shape', () => {
    const withoutArgs = validate([
      createSurface({
        components: [
          {
            action: {
              event: {
                name: 'refresh',
                userMessage: {
                  call: 'formatString',
                  catalogId: BASIC_CATALOG.id,
                },
              },
            },
            child: 'button_label',
            component: 'Button',
            id: 'root',
          },
          { component: 'Text', id: 'button_label', text: 'Refresh' },
        ],
      }),
    ]);
    const legacyReturnType = validate([
      createSurface({
        components: [{
          component: 'Text',
          id: 'root',
          text: {
            args: {},
            call: 'formatString',
            returnType: 'string',
          },
        }],
      }),
    ]);
    const wrongCatalog = validate([
      createSurface({
        components: [{
          component: 'Text',
          id: 'root',
          text: {
            call: 'formatString',
            catalogId: 'urn:other-catalog',
          },
        }],
      }),
    ]);
    const invalidArgs = validate([
      createSurface({
        components: [{
          component: 'Text',
          id: 'root',
          text: { args: 'invalid', call: 'formatString' },
        }],
      }),
    ]);

    expect(withoutArgs.ok).toBe(true);
    expect(legacyReturnType.errors.join('\n')).toContain(
      'must not include legacy "returnType"',
    );
    expect(wrongCatalog.errors.join('\n')).toContain(
      'only supports the active catalog',
    );
    expect(invalidArgs.errors.join('\n')).toContain(
      'must use an object for "args"',
    );
  });

  test('requires the active catalog and rejects duplicate surfaces', () => {
    const missingCatalog = validate([{
      version: 'v1.0',
      createSurface: { surfaceId: 'main' },
    }]);
    const wrongCatalog = validate([
      createSurface({ catalogId: 'urn:other-catalog' }),
    ]);
    const duplicate = validate([createSurface(), createSurface()]);
    const reusedAfterDelete = validate([
      createSurface(),
      {
        version: 'v1.0',
        deleteSurface: { surfaceId: 'main' },
      },
      createSurface(),
    ]);
    const updateAfterDelete = validate([
      createSurface(),
      {
        version: 'v1.0',
        deleteSurface: { surfaceId: 'main' },
      },
      {
        version: 'v1.0',
        updateDataModel: { surfaceId: 'main', value: { stale: true } },
      },
    ]);
    const deletedIncompleteSurface = validate([
      createSurface({
        components: [{ component: 'Text', id: 'temporary', text: 'Soon gone' }],
      }),
      {
        version: 'v1.0',
        deleteSurface: { surfaceId: 'main' },
      },
    ]);

    expect(missingCatalog.ok).toBe(false);
    expect(wrongCatalog.errors.join('\n')).toContain('only supports');
    expect(duplicate.errors.join('\n')).toContain('cannot reuse surfaceId');
    expect(reusedAfterDelete.errors.join('\n')).toContain(
      'cannot reuse surfaceId',
    );
    expect(updateAfterDelete.errors.join('\n')).toContain(
      'references inactive surfaceId',
    );
    expect(deletedIncompleteSurface.ok).toBe(true);
  });

  test('requires updateDataModel.value while accepting null deletion', () => {
    const missingValue = validate([
      createSurface(),
      {
        version: 'v1.0',
        updateDataModel: { surfaceId: 'main' },
      },
    ]);
    const nullDeletion = validate([
      createSurface({ dataModel: { title: 'Hello' } }),
      {
        version: 'v1.0',
        updateDataModel: {
          path: '/title',
          surfaceId: 'main',
          value: null,
        },
      },
    ]);
    const deletedBinding = validate([
      createSurface({
        components: [{
          component: 'Text',
          id: 'root',
          text: { path: '/title' },
        }],
        dataModel: { title: 'Hello' },
      }),
      {
        version: 'v1.0',
        updateDataModel: {
          path: '/title',
          surfaceId: 'main',
          value: null,
        },
      },
    ]);

    expect(missingValue.ok).toBe(false);
    expect(nullDeletion.ok).toBe(true);
    expect(deletedBinding.errors.join('\n')).toContain('not populated');
  });

  test('rejects v0.9, theme, and broken inline component trees', () => {
    const oldVersion = validate([{
      version: 'v0.9',
      createSurface: {
        catalogId: BASIC_CATALOG.id,
        surfaceId: 'main',
      },
    }]);
    const themed = validate([createSurface({ theme: { mode: 'dark' } })]);
    const invalidExtensionKey = validate([
      createSurface({ metadata: { extensions: { 'not-valid': true } } }),
    ]);
    const brokenTree = validate([
      createSurface({
        components: [{
          child: 'missing_child',
          component: 'Card',
          id: 'root',
        }],
      }),
    ]);

    expect(oldVersion.ok).toBe(false);
    expect(themed.ok).toBe(false);
    expect(invalidExtensionKey.ok).toBe(false);
    expect(brokenTree.errors.join('\n')).toContain(
      'references missing child "missing_child"',
    );
  });

  test('sanitizes inline resources without overwriting an inline root', () => {
    const unsafe = JSON.stringify([
      createSurface({
        components: [{
          component: 'Image',
          id: 'root',
          url: 'secret image prompt',
        }],
      }),
    ]);
    const messages = new A2UIProtocolMessageStreamParser({
      hasLoadingComponent: true,
    }).push(unsafe);
    const serialized = JSON.stringify(messages);

    expect(messages).toHaveLength(1);
    expect(serialized).toContain(
      '"id":"root","component":"Loading","variant":"block"',
    );
    expect(serialized).not.toContain('secret image prompt');
  });

  test('adds a temporary root only when createSurface has no inline root', () => {
    const parser = new A2UIProtocolMessageStreamParser({
      hasLoadingComponent: true,
    });
    const inlineRoot = parser.push(
      JSON.stringify([
        createSurface({
          components: [{ component: 'Text', id: 'root', text: 'Ready' }],
        }),
      ]),
    );
    const noRoot = new A2UIProtocolMessageStreamParser({
      hasLoadingComponent: true,
    }).push(
      JSON.stringify([createSurface()]),
    );

    expect(inlineRoot).toHaveLength(1);
    expect(noRoot).toHaveLength(2);
    expect(noRoot[1]).toMatchObject({
      version: 'v1.0',
      updateComponents: {
        components: [{ component: 'Loading', id: 'root' }],
        surfaceId: 'main',
      },
    });
  });

  test('does not invent a Loading component outside the active catalog', () => {
    const createOnly = new A2UIProtocolMessageStreamParser().push(
      JSON.stringify([createSurface()]),
    );
    const unsafeInline = new A2UIProtocolMessageStreamParser().push(
      JSON.stringify([
        createSurface({
          components: [{
            component: 'Image',
            id: 'root',
            url: 'secret image prompt',
          }],
        }),
      ]),
    );
    const unsafeUpdate = new A2UIProtocolMessageStreamParser().push(
      JSON.stringify([{
        version: 'v1.0',
        updateComponents: {
          components: [{
            component: 'Image',
            id: 'root',
            url: 'secret image prompt',
          }],
          surfaceId: 'main',
        },
      }]),
    );

    expect(createOnly).toEqual([createSurface()]);
    expect(unsafeInline).toEqual([createSurface()]);
    expect(unsafeUpdate).toEqual([]);
  });

  test('streams null data deletion but withholds a missing value', () => {
    const parser = new A2UIProtocolMessageStreamParser();
    const messages = parser.push(JSON.stringify([
      {
        version: 'v1.0',
        updateDataModel: { surfaceId: 'main' },
      },
      {
        version: 'v1.0',
        updateDataModel: { surfaceId: 'main', value: null },
      },
    ]));

    expect(messages).toEqual([{
      version: 'v1.0',
      updateDataModel: { surfaceId: 'main', value: null },
    }]);
  });

  test('withholds mixed or extended core envelopes from speculative UI', () => {
    const messages = new A2UIProtocolMessageStreamParser().push(
      JSON.stringify([
        createSurface({ theme: { mode: 'dark' } }),
        {
          ...createSurface(),
          deleteSurface: { surfaceId: 'main' },
        },
        {
          version: 'v1.0',
          updateComponents: {
            components: [{ component: 'Text', id: 'root', text: 'Unsafe' }],
            extra: true,
            surfaceId: 'main',
          },
        },
      ]),
    );

    expect(messages).toEqual([]);
  });
});
