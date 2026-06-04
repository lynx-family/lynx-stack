import type { ServerToClientMessage } from '@lynx-js/genui/a2ui';

export const initialMessages: ServerToClientMessage[] = [
  {
    version: 'v0.9',
    createSurface: {
      surfaceId: 'main',
      catalogId: 'https://a2ui.org/specification/v0_9/basic_catalog.json',
    },
  },
  {
    version: 'v0.9',
    updateComponents: {
      surfaceId: 'main',
      components: [
        {
          id: 'root-card',
          component: 'Card',
          variant: 'elevated',
          child: 'content-column',
        },
        {
          id: 'content-column',
          component: 'Column',
          children: [
            'loading-text',
          ],
          align: 'center',
        },
        {
          id: 'loading-text',
          component: 'Text',
          text: 'Loading...',
          variant: 'body',
        },
      ],
    },
  },
];

export const secondStageMessages: ServerToClientMessage[] = [
  {
    version: 'v0.9',
    updateComponents: {
      surfaceId: 'main',
      components: [
        {
          id: 'content-column',
          component: 'Column',
          children: [
            'title-text',
            'loading-text',
          ],
          align: 'center',
        },
        {
          id: 'title-text',
          component: 'Text',
          text: 'Welcome to A2UI Demo',
          variant: 'h1',
        },
        {
          id: 'loading-text',
          component: 'Text',
          text: 'Loading more content...',
          variant: 'body',
        },
      ],
    },
  },
];

export const thirdStageMessages: ServerToClientMessage[] = [
  {
    version: 'v0.9',
    updateComponents: {
      surfaceId: 'main',
      components: [
        {
          id: 'content-column',
          component: 'Column',
          children: [
            'title-text',
            'description-text',
            'loading-text',
          ],
          align: 'center',
        },
        {
          id: 'description-text',
          component: 'Text',
          text: 'This is a ReactLynx A2UI demonstration',
          variant: 'body',
        },
        {
          id: 'loading-text',
          component: 'Text',
          text: 'Almost done...',
          variant: 'body',
        },
      ],
    },
  },
];

export const finalStageMessages: ServerToClientMessage[] = [
  {
    version: 'v0.9',
    updateComponents: {
      surfaceId: 'main',
      components: [
        {
          id: 'content-column',
          component: 'Column',
          children: [
            'title-text',
            'description-text',
            'action-button',
          ],
          align: 'center',
        },
        {
          id: 'action-button',
          component: 'Button',
          variant: 'primary',
          child: 'button-text',
          action: {
            event: {
              name: 'button_click',
              context: { message: 'Hello from A2UI!' },
            },
          },
        },
        {
          id: 'button-text',
          component: 'Text',
          text: 'Click Me',
        },
      ],
    },
  },
];

export const buttonClickMessages: ServerToClientMessage[] = [
  {
    version: 'v0.9',
    updateComponents: {
      surfaceId: 'main',
      components: [
        {
          id: 'button-text',
          component: 'Text',
          text: 'Clicked!',
        },
      ],
    },
  },
];
