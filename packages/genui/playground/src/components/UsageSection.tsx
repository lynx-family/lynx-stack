// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export function UsageSection() {
  return (
    <section className='usageSection'>
      <h2 className='sectionTitle'>Use the A2UI v1.0 renderer</h2>
      <div className='usageGrid' style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className='usageCard'>
          <h3 className='usageTitle'>Render protocol messages</h3>
          <p className='usageDesc'>
            Choose a catalog and push v1.0 messages into a message store.
          </p>
          <pre className='codeBlock'><code>{`import { A2UI, Text, createMessageStore } from '@lynx-js/genui/a2ui';

const store = createMessageStore();
store.push({
  version: 'v1.0',
  createSurface: {
    surfaceId: 'hello',
    catalogId: 'example',
    components: [{ id: 'root', component: 'Text', text: 'Hello' }],
  },
});

export function App() {
  return <A2UI messageStore={store} catalogs={[Text]} catalogId="example" />;
}`}</code></pre>
        </div>
        <div className='usageCard'>
          <h3 className='usageTitle'>Connect your agent</h3>
          <p className='usageDesc'>
            Forward versioned events and data-model metadata with onMessage.
          </p>
          <pre className='codeBlock'><code>{`<A2UI
  messageStore={store}
  catalogs={catalogs}
  onMessage={(message, metadata) => {
    void fetch('/a2ui/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...message, metadata }),
    })
      .then(response => response.json())
      .then(payload => store.push(normalizePayloadToMessages(payload)));
  }}
/>`}</code></pre>
        </div>
      </div>
    </section>
  );
}
