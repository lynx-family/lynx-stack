// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export function UsageSection() {
  return (
    <section className='usageSection'>
      <h2 className='sectionTitle'>How to Use the ReactLynx A2UI Renderer</h2>
      <div className='usageGrid' style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className='usageCard'>
          <h3 className='usageTitle'>Basic: Conversation Component</h3>
          <p className='usageDesc'>
            An out-of-the-box chat UI that handles history, input, and A2UI
            rendering.
          </p>
          <pre className='codeBlock'>
            <code>{`// Import the v0.9 protocol
import { Conversation } from '@lynx-js/a2ui-reactlynx/0.9';

export default function App() {
  return (
    <Conversation url="https://your-api-endpoint.com/v09/chat" />
  );
}`}</code>
          </pre>
        </div>

        <div className='usageCard'>
          <h3 className='usageTitle'>Advanced: A2UIRender and useLynxClient</h3>
          <p className='usageDesc'>
            Build a custom chat UI with full control over layout and state.
          </p>
          <pre className='codeBlock'>
            <code>{`import { A2UIRender, useLynxClient } from '@lynx-js/a2ui-reactlynx/0.9';

export function CustomChat() {
  const { messages, sendMessage } = useLynxClient("https://api.com/chat");

  return (
    <view>
      <scroll-view>
        {messages.map(msg => (
          <view key={msg.id} className={msg.role}>
            {msg.role === 'user' ? (
              <text>{msg.content}</text>
            ) : (
              <A2UIRender
                resource={msg.resource}
                renderFallback={() => <text>Thinking...</text>}
              />
            )}
          </view>
        ))}
      </scroll-view>
      <text bindtap={() => sendMessage("Hello")}>Send</text>
    </view>
  );
}`}</code>
          </pre>
        </div>

        <div className='usageCard' style={{ gridColumn: '1 / -1' }}>
          <h3 className='usageTitle'>Single-Request Mode (No History)</h3>
          <p className='usageDesc'>
            Set{' '}
            <code>
              keepHistory: false
            </code>{' '}
            to fetch and render resources without persisting message history.
          </p>
          <pre className='codeBlock'>
            <code>{`import { useState } from 'react';
import { A2UIRender, useLynxClient } from '@lynx-js/a2ui-reactlynx/0.9';

export function SingleRequest() {
  const { sendMessage } = useLynxClient("https://api.com/chat", { keepHistory: false });
  const [currentResource, setCurrentResource] = useState(null);

  const handlePress = async () => {
    // sendMessage returns a resource immediately
    const { resource } = await sendMessage("Show me a button");
    setCurrentResource(resource);
  };

  return (
    <view>
      <text bindtap={handlePress}>Request UI</text>
      {currentResource && <A2UIRender resource={currentResource} />}
    </view>
  );
}`}</code>
          </pre>
        </div>
      </div>
    </section>
  );
}
