// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import accountBalance from './account-balance.json';
import advancedFormValidator from './advanced-form-validator.json';
import calendarDay from './calendar-day.json';
import chatMessage from './chat-message.json';
import childListTemplate from './child-list-template.json';
import coffeeOrder from './coffee-order.json';
import contactCard from './contact-card.json';
import countdownTimer from './countdown-timer.json';
import creditCard from './credit-card.json';
import emailCompose from './email-compose.json';
import eventDetail from './event-detail.json';
import financialDataGrid from './financial-data-grid.json';
import flightStatus from './flight-status.json';
import incrementalDashboard from './incremental-dashboard.json';
import liveInvitationBuilder from './live-invitation-builder.json';
import loginForm from './login-form.json';
import markdownText from './markdown-text.json';
import movieCard from './movie-card.json';
import musicPlayer from './music-player.json';
import notificationPermission from './notification-permission.json';
import podcastEpisode from './podcast-episode.json';
import productCard from './product-card.json';
import purchaseComplete from './purchase-complete.json';
import recipeCard from './recipe-card.json';
import restaurantCard from './restaurant-card.json';
import shippingStatus from './shipping-status.json';
import softwarePurchase from './software-purchase.json';
import sportsPlayer from './sports-player.json';
import statsCard from './stats-card.json';
import stepCounter from './step-counter.json';
import taskCard from './task-card.json';
import trackList from './track-list.json';
import userProfile from './user-profile.json';
import weatherCurrent from './weather-current.json';
import workoutSummary from './workout-summary.json';

interface GalleryExampleJson {
  name: string;
  description: string;
  messages: unknown;
}

function toDemo(id: string, demo: GalleryExampleJson) {
  return {
    id,
    title: demo.name,
    description: demo.description,
    messages: demo.messages,
  };
}

export const A2UI_GALLERY_DEMOS = [
  // Copy from A2UI official gallery examples.
  // TODO: If the official A2UI gallery ships as a standalone package, import it as a dependency.
  toDemo('flight-status', flightStatus),
  toDemo('email-compose', emailCompose),
  toDemo('calendar-day', calendarDay),
  toDemo('weather-current', weatherCurrent),
  toDemo('product-card', productCard),
  toDemo('music-player', musicPlayer),
  toDemo('task-card', taskCard),
  toDemo('user-profile', userProfile),
  toDemo('login-form', loginForm),
  toDemo(
    'notification-permission',
    notificationPermission,
  ),
  toDemo('purchase-complete', purchaseComplete),
  toDemo('chat-message', chatMessage),
  toDemo('coffee-order', coffeeOrder),
  toDemo('sports-player', sportsPlayer),
  toDemo('account-balance', accountBalance),
  toDemo('workout-summary', workoutSummary),
  toDemo('event-detail', eventDetail),
  toDemo('track-list', trackList),
  toDemo('software-purchase', softwarePurchase),
  toDemo('restaurant-card', restaurantCard),
  toDemo('shipping-status', shippingStatus),
  toDemo('credit-card', creditCard),
  toDemo('step-counter', stepCounter),
  toDemo('recipe-card', recipeCard),
  toDemo('contact-card', contactCard),
  toDemo('podcast-episode', podcastEpisode),
  toDemo('stats-card', statsCard),
  toDemo('countdown-timer', countdownTimer),
  toDemo('movie-card', movieCard),
  toDemo(
    'live-invitation-builder',
    liveInvitationBuilder,
  ),
  toDemo('incremental-dashboard', incrementalDashboard),
  toDemo(
    'advanced-form-validator',
    advancedFormValidator,
  ),
  toDemo('financial-data-grid', financialDataGrid),
  toDemo('child-list-template', childListTemplate),
  toDemo('markdown-text', markdownText),
] as const;
