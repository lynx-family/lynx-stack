import { useState, useCallback } from '@lynx-js/react';
import { A2UI, createMessageStore, defineCatalog } from '@lynx-js/genui/a2ui';
import {
  catalogManifests,
  Text,
  Button,
  Card,
  Column,
  Row,
  Image,
  type CatalogComponent,
} from '@lynx-js/genui/a2ui/catalog';
import type {
  ServerToClientMessage,
  UserActionPayload,
} from '@lynx-js/genui/a2ui';
import {
  initialMessages,
  secondStageMessages,
  thirdStageMessages,
  finalStageMessages,
  buttonClickMessages,
} from './messages';

import './App.css';

const store = createMessageStore();

const ALL_BUILTINS = defineCatalog([
  [Text as CatalogComponent, catalogManifests.Text],
  [Button as CatalogComponent, catalogManifests.Button],
  [Card as CatalogComponent, catalogManifests.Card],
  [Column as CatalogComponent, catalogManifests.Column],
  [Row as CatalogComponent, catalogManifests.Row],
  [Image as CatalogComponent, catalogManifests.Image],
]).components;

const sleep = (ms: number) => {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
};

export function App() {
  const [showResponse, setShowResponse] = useState(false);

  const streamMessages = useCallback(
    async (messages: ServerToClientMessage[]) => {
      for (const message of messages) {
        store.push(message);
        await sleep(1000);
      }
    },
    [],
  );

  const startDemo = useCallback(async () => {
    setShowResponse(true);
    await streamMessages(initialMessages);
    await streamMessages(secondStageMessages);
    await streamMessages(thirdStageMessages);
    await streamMessages(finalStageMessages);
  }, [streamMessages]);

  const handleAction = useCallback((action: UserActionPayload) => {
    if (action?.name === 'button_click') {
      buttonClickMessages.forEach(msg => {
        store.push(msg);
      });
    }
  }, []);

  return (
    <view className='A2UIApp'>
      <view className='Background' />
      <view className='AppContent'>
        {!showResponse
          ? (
            <view className='WelcomeScreen'>
              <text className='Title'>A2UI Demo</text>
              <text className='Subtitle'>ReactLynx GenUI</text>
              <view className='StartButton' bindtap={startDemo}>
                <text className='ButtonText'>Start Demo</text>
              </view>
            </view>
          )
          : (
            <A2UI
              messageStore={store}
              catalogs={ALL_BUILTINS}
              wrapSurface={(children) => (
                <view className='A2UISurface'>{children}</view>
              )}
              onAction={handleAction}
            />
          )}
      </view>
    </view>
  );
}
