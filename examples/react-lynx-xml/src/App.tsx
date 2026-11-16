import type { IslandStatus } from '@lynx-js/islands/react';
import { Island } from '@lynx-js/islands/react';
import type { IslandReference } from '@lynx-js/islands/runtime';
import { useState } from '@lynx-js/react';

import './App.css';

declare const __XML_MODULE__: IslandReference;

const initial = {
  title: 'XML card ready',
  description: 'Rendered inside the ReactLynx container.',
};
const analysis = {
  title: 'Analyzing…',
  description: 'Processing the dataset on the background thread.',
  values: [8, 3, 21, 5, 13, 2],
};

export function App() {
  const [data, setData] = useState<typeof initial | typeof analysis | null>(
    initial,
  );
  const [status, setStatus] = useState('Loading the XML card.');
  const [backgroundStatus, setBackgroundStatus] = useState(
    'Background not started.',
  );

  function onStatusChange(event: IslandStatus, message?: string) {
    if (!data) return;
    switch (event) {
      case 'ready':
        setStatus('Ready. Update or dispose the card below.');
        setBackgroundStatus(
          'Preparing background… Local updates are available.',
        );
        break;
      case 'updated':
        setStatus('Updated locally.');
        break;
      case 'background-ready':
        setBackgroundStatus('Background ready.');
        break;
      case 'background-error':
        setBackgroundStatus(
          `Background unavailable: ${message}. Local updates remain available.`,
        );
        break;
      case 'render-error':
        setStatus(`XML render failed: ${message}`);
        setData(null);
        break;
      case 'update-error':
        setStatus(`XML update failed: ${message}`);
        break;
    }
  }

  function render() {
    if (!data) setStatus('Loading XML…');
    setData({ ...initial });
  }

  function update() {
    if (data) setData({ ...analysis });
    else setStatus('Render the card before updating.');
  }

  function dispose() {
    setData(null);
    setStatus('Disposed. Render again to reuse the loaded module.');
    setBackgroundStatus('Disposed.');
  }

  return (
    <view className='App'>
      <text className='Title'>ReactLynx + Lynx XML</text>
      <text className='Description'>
        Render, update, and dispose content in a fixed container.
      </text>
      <view className='LoadButton' bindtap={render}>
        <text className='LoadButtonText'>Render XML card</text>
      </view>
      <view className='Actions'>
        <view className='ActionButton' bindtap={update}>
          <text className='LoadButtonText'>Analyze data</text>
        </view>
        <view className='ActionButton' bindtap={dispose}>
          <text className='LoadButtonText'>Dispose</text>
        </view>
      </view>
      <text className='Status'>{status}</text>
      <text className='Status'>{backgroundStatus}</text>
      <Island
        id='xml-content'
        className='XmlContainer'
        module={data ? __XML_MODULE__ : null}
        props={data ?? initial}
        onStatusChange={onStatusChange}
      />
    </view>
  );
}
