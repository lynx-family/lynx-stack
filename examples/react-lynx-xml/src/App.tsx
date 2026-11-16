import type { ParcelSource } from '@lynx-js/parcels/runtime/core';
import type { ParcelStatus } from '@lynx-js/parcels/runtime/react';
import { ParcelView } from '@lynx-js/parcels/runtime/react';
import { useState } from '@lynx-js/react';

import './App.css';

declare const __XML_SOURCE__: ParcelSource;

const initial = {
  title: 'XML card ready',
  description: 'Mounted inside the ReactLynx container.',
};
const analysis = {
  title: 'Analyzing…',
  description: 'Processing the dataset on the background thread.',
  values: [8, 3, 21, 5, 13, 2],
};

export function App() {
  const [data, setData] = useState<typeof initial | typeof analysis | null>(
    null,
  );
  const [status, setStatus] = useState('Mount the XML card to begin.');
  const [backgroundStatus, setBackgroundStatus] = useState(
    'Background not started.',
  );

  function onStatusChange(event: ParcelStatus, message?: string) {
    if (!data) return;
    switch (event) {
      case 'mounted':
        setStatus('Mounted. Update or unmount the card below.');
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
      case 'mount-error':
        setStatus(`XML mount failed: ${message}`);
        setData(null);
        break;
      case 'update-error':
        setStatus(`XML update failed: ${message}`);
        break;
    }
  }

  function mount() {
    if (!data) setStatus('Loading XML…');
    setData({ ...initial });
  }

  function update() {
    if (data) setData({ ...analysis });
    else setStatus('Mount the card before updating.');
  }

  function unmount() {
    setData(null);
    setStatus('Unmounted. Mount again to reuse the loaded module.');
    setBackgroundStatus('Unmounted.');
  }

  return (
    <view className='App'>
      <text className='Title'>ReactLynx + Lynx XML</text>
      <text className='Description'>
        Mount, update, and unmount content in a fixed container.
      </text>
      <view className='LoadButton' bindtap={mount}>
        <text className='LoadButtonText'>Mount XML card</text>
      </view>
      <view className='Actions'>
        <view className='ActionButton' bindtap={update}>
          <text className='LoadButtonText'>Analyze data</text>
        </view>
        <view className='ActionButton' bindtap={unmount}>
          <text className='LoadButtonText'>Unmount</text>
        </view>
      </view>
      <text className='Status'>{status}</text>
      <text className='Status'>{backgroundStatus}</text>
      <ParcelView
        id='xml-content'
        className='XmlContainer'
        source={data ? __XML_SOURCE__ : null}
        data={data ?? initial}
        onStatusChange={onStatusChange}
      />
    </view>
  );
}
