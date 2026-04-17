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
      '__et_builtin_raw_text__',
      null,
      ['hello'],
      [],
      ElementTemplateUpdateOps.setAttribute,
      2,
      3,
      'next',
    ];

    expect(formatUpdateStream(stream)).toEqual([
      {
        type: 'create',
        id: 1,
        template: '__et_builtin_raw_text__',
        attributeSlots: ['hello'],
        elementSlots: [],
      },
      {
        type: 'setAttribute',
        id: 2,
        attrSlotIndex: 3,
        value: 'next',
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
