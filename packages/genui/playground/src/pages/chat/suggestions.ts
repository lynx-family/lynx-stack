// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ChatSuggestion } from './type.js';

export const CHAT_PROMPT_SUGGESTIONS = [
  {
    label: '🌤️ Weather with Refresh',
    text:
      'Create a weather card for San Francisco showing sunny, a photo, 22°C, humidity 60%, and a "Refresh" button. When the user taps Refresh, update the card with slightly different weather data to simulate a live fetch.',
  },
  {
    label: '🛍️ Product card with Buy',
    text:
      'Create a product card for a limited-edition sneaker. Include name, a photo, price ($189), a short description, and a "Buy Now" button. When tapped, show a purchase confirmation step with a "Confirm Purchase" button. Only the Confirm Purchase button should submit the action; after the action response, replace the card with an order success page showing a fake order number and estimated delivery.',
  },
  {
    label: '⚡ Quiz card with actions',
    text:
      'Create a trivia quiz card. Show a question "Which shape has three sides?" with 4 answer buttons: Triangle, Square, Circle, Hexagon. When the user taps an answer, show whether it is correct with a brief explanation.',
  },
] as const satisfies readonly ChatSuggestion[];
