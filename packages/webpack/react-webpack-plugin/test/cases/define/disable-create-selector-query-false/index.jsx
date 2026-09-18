/// <reference types="vitest/globals" />

import { Component } from '@lynx-js/react';

it('__DISABLE_CREATE_SELECTOR_QUERY_INCOMPATIBLE_WARNING__ should be false', () => {
  expect(__DISABLE_CREATE_SELECTOR_QUERY_INCOMPATIBLE_WARNING__).toBe(false);
});

it('should report error when this.getNodeRef is called', () => {
  const c = new Component({});

  const app = lynx.getApp();
  vi.stubGlobal('lynx', {
    reportError: vi.fn(),
    getApp: () => app,
  });

  const getNodeRef = vi.fn();

  app._reactLynx = {
    ReactComponent: class {
      getNodeRef() {
        getNodeRef();
      }
    },
  };

  c.getNodeRef();

  expect(lynx.reportError).toBeCalled();
  expect(getNodeRef).toBeCalled();
});
