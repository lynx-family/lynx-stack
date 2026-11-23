import '@lynx-js/react/debug';
import { Fragment, useState } from 'react';

import { root } from '@lynx-js/react';

import { App } from './App.js';

import './index.css';

function logTapHint() {
  'background only';
  void import('./utils.js').then(({ formatTapCount }) => {
    console.info(formatTapCount(0));
  });
}

logTapHint();

declare const __MESSAGE_BUNDLE_URL__: string;

export function LoadMessage() {
  const [label, setLabel] = useState('Deliver URL and load message');
  async function load() {
    'background only';
    Object.assign(globalThis, { selectedMessageUrl: __MESSAGE_BUNDLE_URL__ });
    console.info('[dynamic-message] URL delivered; importing message');
    try {
      const { message } = await import('./message.js');
      setLabel(message);
    } catch (error) {
      setLabel(String(error));
    }
  }
  return (
    <view
      className='LoadMessage'
      bindtap={() => {
        void load();
      }}
    >
      <text className='LoadMessageLabel'>{label}</text>
    </view>
  );
}

root.render(
  // biome-ignore lint/style/useFragmentSyntax: Just to demonstrate import react is external
  <Fragment>
    <App>
      <LoadMessage />
    </App>
  </Fragment>,
);

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept();
}
