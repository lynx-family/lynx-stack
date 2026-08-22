import type { ServerToClientMessage } from '@lynx-js/genui/a2ui';

export const initialMessages: ServerToClientMessage[] = [
  {
    version: 'v1.0',
    createSurface: {
      surfaceId: 'main',
      catalogId: 'https://unpkg.com/@lynx-js/genui/a2ui/dist/catalog.json',
      components: [
        {
          id: 'root',
          component: 'Card',
          variant: 'elevated',
          child: 'content_column',
        },
        {
          id: 'content_column',
          component: 'Column',
          children: [
            'loading_text',
          ],
          align: 'center',
        },
        {
          id: 'loading_text',
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
    version: 'v1.0',
    updateComponents: {
      surfaceId: 'main',
      components: [
        {
          id: 'content_column',
          component: 'Column',
          children: [
            'title_text',
            'loading_text',
          ],
          align: 'center',
        },
        {
          id: 'title_text',
          component: 'Text',
          text: 'Welcome to A2UI Demo',
          variant: 'h1',
        },
        {
          id: 'loading_text',
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
    version: 'v1.0',
    updateComponents: {
      surfaceId: 'main',
      components: [
        {
          id: 'content_column',
          component: 'Column',
          children: [
            'title_text',
            'description_text',
            'loading_text',
          ],
          align: 'center',
        },
        {
          id: 'description_text',
          component: 'Text',
          text: 'This is a ReactLynx A2UI demonstration',
          variant: 'body',
        },
        {
          id: 'loading_text',
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
    version: 'v1.0',
    updateComponents: {
      surfaceId: 'main',
      components: [
        {
          id: 'content_column',
          component: 'Column',
          children: [
            'title_text',
            'description_text',
            'action_button',
          ],
          align: 'center',
        },
        {
          id: 'action_button',
          component: 'Button',
          variant: 'primary',
          child: 'button_text',
          action: {
            event: {
              name: 'button_click',
              context: { message: 'Hello from A2UI!' },
            },
          },
        },
        {
          id: 'button_text',
          component: 'Text',
          text: 'Click Me',
        },
      ],
    },
  },
];

export const buttonClickMessages: ServerToClientMessage[] = [
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: 'main',
      components: [
        {
          id: 'button_text',
          component: 'Text',
          text: 'Clicked!',
        },
      ],
    },
  },
];
