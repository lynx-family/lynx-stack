import { describe, expect, it } from 'vitest';

import { root } from '../../../../src/element-template/index.js';
import { ElementTemplateUpdateOps } from '../../../../src/element-template/protocol/opcodes.js';
import type { ElementTemplateUpdateCommandStream } from '../../../../src/element-template/protocol/types.js';
import { formatUpdateStream, runElementTemplateUpdate } from './updateRunner.js';

describe('element-template update runner', () => {
  it('formats update stream entries', () => {
    const stream: ElementTemplateUpdateCommandStream = [
      ElementTemplateUpdateOps.createTemplate,
      1,
      '_et_builtin_raw_text',
      null,
      ['hello'],
      [],
      null,
      ElementTemplateUpdateOps.setAttribute,
      2,
      3,
      'next',
      ElementTemplateUpdateOps.setMainThreadEvent,
      2,
      4,
      { type: 'worklet' },
      ElementTemplateUpdateOps.setMainThreadRef,
      2,
      5,
      { type: 'main-thread-ref' },
      ElementTemplateUpdateOps.createTypedElement,
      8,
      'list',
      { id: 'typed-list' },
      [[1]],
      {},
      ElementTemplateUpdateOps.setAttribute,
      8,
      0,
      { insertAction: [] },
      ElementTemplateUpdateOps.insertNode,
      8,
      0,
      2,
      1,
      [2],
      ElementTemplateUpdateOps.removeNode,
      8,
      0,
      1,
      [1],
      ElementTemplateUpdateOps.updateTypedListItem,
      8,
      { __etHandleRef: 2, type: '_et_item', platformInfo: { 'item-key': 'c' }, subtreeHandleIds: null },
      ElementTemplateUpdateOps.removeNode,
      4,
      5,
      6,
      [6, 7],
    ];

    expect(formatUpdateStream(stream)).toEqual([
      {
        type: 'create',
        id: 1,
        template: '_et_builtin_raw_text',
        attributeSlots: ['hello'],
        childSlots: [],
        options: null,
      },
      {
        type: 'setAttribute',
        id: 2,
        attrSlotIndex: 3,
        value: 'next',
      },
      {
        type: 'setMainThreadEvent',
        id: 2,
        attrSlotIndex: 4,
        value: { type: 'worklet' },
      },
      {
        type: 'setMainThreadRef',
        id: 2,
        attrSlotIndex: 5,
        value: { type: 'main-thread-ref' },
      },
      {
        type: 'createTypedElement',
        id: 8,
        elementType: 'list',
        attributes: { id: 'typed-list' },
        childSlots: [[1]],
        options: {},
      },
      {
        type: 'setAttribute',
        id: 8,
        attrSlotIndex: 0,
        value: { insertAction: [] },
      },
      {
        type: 'insertNode',
        id: 8,
        childSlotIndex: 0,
        child: 2,
        reference: 1,
        attachedSubtreeHandleIds: [2],
      },
      {
        type: 'removeNode',
        id: 8,
        childSlotIndex: 0,
        child: 1,
        removedSubtreeHandleIds: [1],
      },
      {
        type: 'updateTypedListItem',
        id: 8,
        item: { __etHandleRef: 2, type: '_et_item', platformInfo: { 'item-key': 'c' }, subtreeHandleIds: null },
      },
      {
        type: 'removeNode',
        id: 4,
        childSlotIndex: 5,
        child: 6,
        removedSubtreeHandleIds: [6, 7],
      },
    ]);
  });

  it('collects update output and patch formatting state', () => {
    let label = 'before';

    function App() {
      return <view attrs={{ 0: { id: label } }} />;
    }

    const result = runElementTemplateUpdate({
      render: () => <App />,
      update: () => {
        label = 'after';
        root.render(<App />);
      },
    });

    expect(result.beforePageJsx).toContain('"before"');
    expect(result.afterPageJsx).toContain('"after"');
    expect(result.formattedOps).toHaveLength(1);
    expect(result.formattedOps[0]).toMatchObject({
      type: 'setAttribute',
      attrSlotIndex: 0,
      value: { 0: { id: 'after' } },
    });
  });
});
