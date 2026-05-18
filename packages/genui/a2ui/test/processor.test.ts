// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { MessageProcessor } from '../src/store/MessageProcessor.js';
import type { ServerToClientMessage } from '../src/store/types.js';

describe('MessageProcessor', () => {
  test('onUpdate supports multiple listeners', () => {
    const proc = new MessageProcessor();
    const calls1: unknown[] = [];
    const calls2: unknown[] = [];

    proc.onUpdate((data) => calls1.push(data));
    proc.onUpdate((data) => calls2.push(data));

    proc.processMessages([
      { createSurface: { surfaceId: 's1', catalogId: 'test' } },
      {
        updateComponents: {
          surfaceId: 's1',
          components: [{ id: 'root', component: 'Text', text: 'hi' }],
        },
      },
    ] as ServerToClientMessage[]);

    expect(calls1.length).toBeGreaterThan(0);
    expect(calls2.length).toBe(calls1.length);
  });

  test('onUpdate disposer unsubscribes', () => {
    const proc = new MessageProcessor();
    const calls1: unknown[] = [];
    const calls2: unknown[] = [];

    const dispose1 = proc.onUpdate((d) => calls1.push(d));
    proc.onUpdate((d) => calls2.push(d));
    dispose1();

    proc.processMessages([
      { createSurface: { surfaceId: 's1' } },
      {
        updateComponents: {
          surfaceId: 's1',
          components: [{ id: 'root', component: 'Text' }],
        },
      },
    ] as ServerToClientMessage[]);

    expect(calls1.length).toBe(0);
    expect(calls2.length).toBeGreaterThan(0);
  });

  test('beginRendering fires when root component lands', () => {
    const proc = new MessageProcessor();
    const events: { type: string; surfaceId: string }[] = [];
    proc.onUpdate((d) => {
      events.push(d as { type: string; surfaceId: string });
    });

    proc.processMessages([
      { createSurface: { surfaceId: 's1' } },
      {
        updateComponents: {
          surfaceId: 's1',
          components: [{ id: 'root', component: 'Text', text: 'hi' }],
        },
      },
    ] as ServerToClientMessage[]);

    expect(events.some((e) => e.type === 'beginRendering')).toBe(true);
    expect(events.some((e) => e.type === 'surfaceUpdate')).toBe(true);
  });

  test('deleteSurface emits and clears state', () => {
    const proc = new MessageProcessor();
    proc.processMessages([
      { createSurface: { surfaceId: 's1' } },
      {
        updateComponents: {
          surfaceId: 's1',
          components: [{ id: 'root', component: 'Text' }],
        },
      },
    ] as ServerToClientMessage[]);

    expect(proc.getSurfaces().has('s1')).toBe(true);

    const events: string[] = [];
    proc.onUpdate((d) => events.push((d as { type: string }).type));
    proc.processMessages([
      { deleteSurface: { surfaceId: 's1' } },
    ] as ServerToClientMessage[]);

    expect(events).toContain('deleteSurface');
    expect(proc.getSurfaces().has('s1')).toBe(false);
  });

  test('updateDataModel writes to surface store', () => {
    const proc = new MessageProcessor();
    proc.processMessages([
      { createSurface: { surfaceId: 's1' } },
      {
        updateComponents: {
          surfaceId: 's1',
          components: [{ id: 'root', component: 'Text' }],
        },
      },
      {
        updateDataModel: { surfaceId: 's1', path: '/title', value: 'hello' },
      },
    ] as ServerToClientMessage[]);

    const surface = proc.getOrCreateSurface('s1');
    expect(surface.store.getSignal('/title').value).toBe('hello');
  });

  test('template expansion rewrites Modal child references', () => {
    const proc = new MessageProcessor();
    proc.processMessages([
      { createSurface: { surfaceId: 's1' } },
      {
        updateComponents: {
          surfaceId: 's1',
          components: [
            {
              id: 'root',
              component: 'Column',
              children: { componentId: 'modal-template', path: '/items' },
            },
            {
              id: 'modal-template',
              component: 'Modal',
              trigger: 'modal-trigger',
              content: 'modal-content',
            },
            {
              id: 'modal-trigger',
              component: 'Text',
              text: { path: 'title' },
            },
            {
              id: 'modal-content',
              component: 'Text',
              text: { path: 'body' },
            },
          ],
        },
      },
      {
        updateDataModel: {
          surfaceId: 's1',
          value: {
            items: [{ title: 'Open', body: 'Details' }],
          },
        },
      },
    ] as ServerToClientMessage[]);

    const surface = proc.getOrCreateSurface('s1');
    const modal = surface.components.get('modal-template:0') as
      | (Record<string, unknown> & { dataContextPath?: string })
      | undefined;

    expect(modal?.trigger).toBe('modal-trigger:0');
    expect(modal?.content).toBe('modal-content:0');
    expect(modal?.children).toBeUndefined();
    expect(modal?.dataContextPath).toBe('/items/0');
    expect(surface.components.get('modal-trigger:0')?.dataContextPath).toBe(
      '/items/0',
    );
  });

  test('template expansion rewrites Tabs child references', () => {
    const proc = new MessageProcessor();
    proc.processMessages([
      { createSurface: { surfaceId: 's1' } },
      {
        updateComponents: {
          surfaceId: 's1',
          components: [
            {
              id: 'root',
              component: 'Column',
              children: { componentId: 'tabs-template', path: '/items' },
            },
            {
              id: 'tabs-template',
              component: 'Tabs',
              tabs: [{ title: 'Overview', child: 'tab-content' }],
            },
            {
              id: 'tab-content',
              component: 'Text',
              text: { path: 'body' },
            },
          ],
        },
      },
      {
        updateDataModel: {
          surfaceId: 's1',
          value: {
            items: [{ body: 'Details' }],
          },
        },
      },
    ] as ServerToClientMessage[]);

    const surface = proc.getOrCreateSurface('s1');
    const tabs = surface.components.get('tabs-template:0') as
      | Record<string, unknown>
      | undefined;
    const tabItems = tabs?.tabs as Record<string, unknown>[] | undefined;

    expect(tabItems?.[0]?.child).toBe('tab-content:0');
    expect(tabs?.children).toBeUndefined();
  });

  test('dispatch with no listeners resolves with empty array', async () => {
    const proc = new MessageProcessor();
    const result = await proc.dispatch({ userAction: { name: 'x' } });
    expect(result).toEqual([]);
  });

  test('onEvent multi-listener with disposer', () => {
    const proc = new MessageProcessor();
    const calls1: unknown[] = [];
    const calls2: unknown[] = [];
    const d1 = proc.onEvent((e) => {
      calls1.push(e.message);
      e.resolve(null);
    });
    proc.onEvent((e) => {
      calls2.push(e.message);
      e.resolve(null);
    });

    void proc.dispatch({ x: 1 });
    expect(calls1.length).toBe(1);
    expect(calls2.length).toBe(1);

    d1();
    void proc.dispatch({ x: 2 });
    expect(calls1.length).toBe(1);
    expect(calls2.length).toBe(2);
  });
});
