// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface A2UIExample {
  name: string;
  user: string;
  messages: unknown[];
}

const BASIC_CATALOG_ID =
  'https://a2ui.org/specification/v0_9/basic_catalog.json';

export const BASIC_CATALOG_EXAMPLES: A2UIExample[] = [
  {
    name: 'login-card',
    user: 'Generate a login card with email, password, and a submit button.',
    messages: [
      {
        version: 'v0.9',
        createSurface: {
          surfaceId: 'main',
          catalogId: BASIC_CATALOG_ID,
        },
      },
      {
        version: 'v0.9',
        updateDataModel: {
          surfaceId: 'main',
          value: { form: { email: '', password: '' } },
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'main',
          components: [
            { id: 'root', component: 'Card', child: 'form-column' },
            {
              id: 'form-column',
              component: 'Column',
              children: ['title', 'email', 'password', 'submit'],
            },
            { id: 'title', component: 'Text', text: 'Sign in', variant: 'h2' },
            {
              id: 'email',
              component: 'TextField',
              label: 'Email',
              value: { path: '/form/email' },
            },
            {
              id: 'password',
              component: 'TextField',
              label: 'Password',
              variant: 'obscured',
              value: { path: '/form/password' },
            },
            {
              id: 'submit',
              component: 'Button',
              variant: 'primary',
              child: 'submit-label',
              action: {
                event: {
                  name: 'submit_login',
                  context: {
                    email: { path: '/form/email' },
                    password: { path: '/form/password' },
                  },
                },
              },
            },
            { id: 'submit-label', component: 'Text', text: 'Sign in' },
          ],
        },
      },
    ],
  },
  {
    name: 'dynamic-list',
    user: 'Show three trip ideas as a compact vertical group.',
    messages: [
      {
        version: 'v0.9',
        createSurface: {
          surfaceId: 'main',
          catalogId: BASIC_CATALOG_ID,
        },
      },
      {
        version: 'v0.9',
        updateDataModel: {
          surfaceId: 'main',
          path: '/items',
          value: [
            { name: 'Canal walk', detail: 'Morning coffee and quiet bridges' },
            {
              name: 'Museum loop',
              detail: 'Design exhibits plus lunch nearby',
            },
            { name: 'Sunset hill', detail: 'Short climb with skyline views' },
          ],
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'main',
          components: [
            {
              id: 'root',
              component: 'Column',
              children: ['title', 'trip-items'],
            },
            {
              id: 'title',
              component: 'Text',
              text: 'Trip ideas',
              variant: 'h2',
            },
            {
              id: 'trip-items',
              component: 'Column',
              children: { path: '/items', componentId: 'trip-row' },
            },
            {
              id: 'trip-row',
              component: 'Row',
              children: ['trip-icon', 'trip-copy'],
              align: 'center',
            },
            { id: 'trip-icon', component: 'Icon', name: 'location_on' },
            {
              id: 'trip-copy',
              component: 'Column',
              children: ['trip-name', 'trip-detail'],
            },
            {
              id: 'trip-name',
              component: 'Text',
              text: { path: 'name' },
              variant: 'h3',
            },
            {
              id: 'trip-detail',
              component: 'Text',
              text: { path: 'detail' },
              variant: 'body',
            },
          ],
        },
      },
    ],
  },
  {
    name: 'chart-card',
    user: 'Show weekly active users as a line chart.',
    messages: [
      {
        version: 'v0.9',
        createSurface: {
          surfaceId: 'main',
          catalogId: BASIC_CATALOG_ID,
        },
      },
      {
        version: 'v0.9',
        updateDataModel: {
          surfaceId: 'main',
          value: {
            chart: {
              labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
              series: [{ name: 'Users', values: [120, 148, 132, 171, 190] }],
            },
          },
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'main',
          components: [
            { id: 'root', component: 'Card', child: 'chart-column' },
            {
              id: 'chart-column',
              component: 'Column',
              children: ['title', 'chart'],
            },
            {
              id: 'title',
              component: 'Text',
              text: 'Weekly active users',
              variant: 'h2',
            },
            {
              id: 'chart',
              component: 'LineChart',
              labels: { path: '/chart/labels' },
              series: { path: '/chart/series' },
              xLabel: 'Day',
              yLabel: 'Users',
              showGrid: true,
              showLegend: true,
            },
          ],
        },
      },
    ],
  },
  {
    name: 'action-update',
    user:
      'A2UI_USER_ACTION: {"surfaceId":"main","action":{"name":"submit_login","context":{"email":"me@example.com"}}}',
    messages: [
      {
        version: 'v0.9',
        updateDataModel: {
          surfaceId: 'main',
          path: '/status',
          value: {
            kind: 'success',
            message: 'Signed in as me@example.com',
          },
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'main',
          components: [
            {
              id: 'root',
              component: 'Card',
              child: 'status-column',
            },
            {
              id: 'status-column',
              component: 'Column',
              children: ['status-title', 'status-message'],
            },
            {
              id: 'status-title',
              component: 'Text',
              text: 'Success',
              variant: 'h2',
            },
            {
              id: 'status-message',
              component: 'Text',
              text: { path: '/status/message' },
            },
          ],
        },
      },
    ],
  },
];
