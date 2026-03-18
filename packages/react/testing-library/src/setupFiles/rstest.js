import '../env/rstest.js';
import './common/runtime-setup.js';
import './inner/rstest.js';
import './common/bootstrap.js';
import { expect } from '@rstest/core';

expect.addSnapshotSerializer({
  test(val) {
    return Boolean(
      val
        && typeof val === 'object'
        && Array.isArray(val.refAttr)
        && Object.prototype.hasOwnProperty.call(val, 'task')
        && typeof val.exec === 'function',
    );
  },
  print(val, serialize) {
    const printed = serialize({
      refAttr: Array.isArray(val.refAttr) ? [...val.refAttr] : val.refAttr,
      task: val.task,
    });
    if (printed.startsWith('Object')) {
      return printed.replace(/^Object/, 'RefProxy');
    }
    if (printed.startsWith('{')) {
      return `RefProxy ${printed}`;
    }
    return printed;
  },
});
