import React from 'react';
import { useEffect } from 'react';
import { useEffect as useMyEffect } from 'react';

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
