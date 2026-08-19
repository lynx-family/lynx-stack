// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { BASIC_CATALOG_ID } from './a2ui-catalog-id';

/**
 * Validated user request and message sequence included as an in-context A2UI
 * example.
 */
export interface A2UIExample {
  name: string;
  user: string;
  messages: unknown[];
}

export const BASIC_CATALOG_EXAMPLES: A2UIExample[] = [
  {
    name: 'login-card',
    user: 'Generate a login card with email, password, and a submit button.',
    messages: [
      {
        version: 'v1.0',
        createSurface: {
          surfaceId: 'main',
          catalogId: BASIC_CATALOG_ID,
          dataModel: { form: { email: '', password: '' } },
          components: [
            { id: 'root', component: 'Card', child: 'form_column' },
            {
              id: 'form_column',
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
              child: 'submit_label',
              action: {
                event: {
                  name: 'submit_login',
                  userMessage: 'Sign me in',
                  context: {
                    email: { path: '/form/email' },
                    password: { path: '/form/password' },
                  },
                },
              },
            },
            { id: 'submit_label', component: 'Text', text: 'Sign in' },
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
        version: 'v1.0',
        createSurface: {
          surfaceId: 'main',
          catalogId: BASIC_CATALOG_ID,
        },
      },
      {
        version: 'v1.0',
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
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'main',
          components: [
            {
              id: 'root',
              component: 'Column',
              children: ['title', 'trip_items'],
            },
            {
              id: 'title',
              component: 'Text',
              text: 'Trip ideas',
              variant: 'h2',
            },
            {
              id: 'trip_items',
              component: 'Column',
              children: { path: '/items', componentId: 'trip_row' },
            },
            {
              id: 'trip_row',
              component: 'Row',
              children: ['trip_icon', 'trip_copy'],
              align: 'center',
            },
            { id: 'trip_icon', component: 'Icon', name: 'location_on' },
            {
              id: 'trip_copy',
              component: 'Column',
              children: ['trip_name', 'trip_detail'],
            },
            {
              id: 'trip_name',
              component: 'Text',
              text: { path: 'name' },
              variant: 'h3',
            },
            {
              id: 'trip_detail',
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
        version: 'v1.0',
        createSurface: {
          surfaceId: 'main',
          catalogId: BASIC_CATALOG_ID,
        },
      },
      {
        version: 'v1.0',
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
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'main',
          components: [
            { id: 'root', component: 'Card', child: 'chart_column' },
            {
              id: 'chart_column',
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
      'A2UI_USER_ACTION: {"version":"v1.0","action":{"name":"submit_login","surfaceId":"main","sourceComponentId":"submit","timestamp":"2026-01-01T00:00:00.000Z","context":{"email":"me@example.com"}}}',
    messages: [
      {
        version: 'v1.0',
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
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'main',
          components: [
            {
              id: 'root',
              component: 'Card',
              child: 'status_column',
            },
            {
              id: 'status_column',
              component: 'Column',
              children: ['status_title', 'status_message'],
            },
            {
              id: 'status_title',
              component: 'Text',
              text: 'Success',
              variant: 'h2',
            },
            {
              id: 'status_message',
              component: 'Text',
              text: { path: '/status/message' },
            },
          ],
        },
      },
    ],
  },
];
