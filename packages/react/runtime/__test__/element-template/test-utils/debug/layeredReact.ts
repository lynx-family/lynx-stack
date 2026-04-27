import reactLynxDefault from '../../../../src/element-template/index.js';
import * as hooks from './layeredHooks.js';

export * from '../../../../src/element-template/index.js';
export * from './layeredHooks.js';

export default {
  ...reactLynxDefault,
  ...hooks,
};
