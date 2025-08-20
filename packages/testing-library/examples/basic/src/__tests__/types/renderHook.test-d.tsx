import '@testing-library/jest-dom';
import { test } from 'vitest';
import { renderHook } from '@lynx-js/react/testing-library';
import { createContext, useContext } from '@lynx-js/react';

test('renderHook', () => {
  const Context = createContext('default');
  renderHook(
    () => {
      return useContext(Context);
    },
    {
      wrapper: function Wrapper({ children }) {
        return <Context.Provider value='provided'>{children}</Context.Provider>;
      },
    },
  );
});
