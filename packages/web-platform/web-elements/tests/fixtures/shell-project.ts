import '../../src/compat/LinearContainer/LinearContainer.js';
import '../../src/elements/all.js';
import '../../src/elements/XMarkdown/index.js';
import '../../index.css';
import '@lynx-js/playwright-fixtures/common.css';
import { Component } from '../../src/element-reactive/component.js';
import { registerEventEnableStatusChangeHandler } from '../../src/element-reactive/registerEventStatusChangedHandler.js';

(globalThis as any).Component = Component;
(globalThis as any).registerEventEnableStatusChangeHandler =
  registerEventEnableStatusChangeHandler;
// Trigger rebuild
