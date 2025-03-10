import React, { forwardRef, useImperativeHandle } from 'react';
import { useEffect } from 'react';
import { useEffect as useMyEffect } from 'react';

export default forwardRef(function App(_, ref) {
  function bar() {
    console.info('This should not exist in main-thread');
  }
  useImperativeHandle(ref, () => {
    console.info('This should not exist in main-thread');
    return {
      name() {
        console.info('This should not exist in main-thread');
      },
      bar,
      baz: 'This should not exist in main-thread',
    };
  });
  useEffect(() => {
    console.info('This should not exist in main-thread');
  }, []);

  useMyEffect(() => {
    // TODO: import alias is not removed
  });

  React.useEffect(() => {
    // TODO: default import is not removed
  });
});
