import { Island } from '@lynx-js/islands/react';
import { useState } from '@lynx-js/react';
import type { FrameLoadEvent, FrameLoadMetricsEvent } from '@lynx-js/types';

import './App.css';

declare const __XML_RENDERER__: 'island' | 'frame';
declare const __XML_FRAME_SRC__: string;
declare const __XML_BENCHMARK__: boolean;

const initial = {
  title: 'XML card ready',
  description: 'Rendered inside the ReactLynx container.',
};
const analysis = {
  title: 'Analyzing…',
  description: 'Processing the dataset on the background thread.',
  values: [8, 3, 21, 5, 13, 2],
};

function onFrameMetrics(event: FrameLoadMetricsEvent) {
  console.info('XML frame metrics', JSON.stringify(event.detail));
}

export function App() {
  const [data, setData] = useState<typeof initial | typeof analysis | null>(
    initial,
  );
  const [status, setStatus] = useState('Update or dispose the XML card below.');

  function onFrameLoad(event: FrameLoadEvent) {
    console.info('XML frame load', JSON.stringify(event.detail));
    if (__XML_BENCHMARK__) return;
    setStatus(
      event.detail.statusCode === 0
        ? 'Frame ready.'
        : event.detail.statusMessage,
    );
  }

  function render() {
    setStatus('Showing the XML card.');
    setData({ ...initial });
  }

  function update() {
    lynx.performance.profileStart('XmlComparison::updateRequested');
    if (data) {
      setData({ ...analysis });
      setStatus('Analyzing the data.');
    } else setStatus('Render the card before updating.');
    lynx.performance.profileEnd();
  }

  function dispose() {
    setData(null);
    setStatus('Disposed. Render again to reuse the loaded module.');
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
      {__XML_RENDERER__ === 'frame'
        ? (
          data
            ? (
              <frame
                id='xml-content'
                className='XmlContainer'
                src={__XML_FRAME_SRC__}
                data={data}
                bindload={onFrameLoad}
                bindloadmetrics={onFrameMetrics}
              />
            )
            : <view id='xml-content' className='XmlContainer' />
        )
        : (
          data
            ? <Island name='xml-card' className='XmlContainer' props={data} />
            : <view className='XmlContainer' />
        )}
    </view>
  );
}
