import React from '@lynx-js/react';
import { useEffect } from '@lynx-js/react';
import { useEffect as useMyEffect } from '@lynx-js/react';

export default function App() {
  useEffect(() => {
    console.info('This should not exist in main-thread');
  }, []);

  useMyEffect(() => {
    console.info('This should not exist in main-thread');
  });

  React.useEffect(() => {
    console.info('This should not exist in main-thread');
  });
}
