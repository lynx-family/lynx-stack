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
  toDemo('flight-status', flightStatus as GalleryExampleJson),
  toDemo('email-compose', emailCompose as GalleryExampleJson),
  toDemo('calendar-day', calendarDay as GalleryExampleJson),
  toDemo('weather-current', weatherCurrent as GalleryExampleJson),
  toDemo('product-card', productCard as GalleryExampleJson),
  toDemo('music-player', musicPlayer as GalleryExampleJson),
  toDemo('task-card', taskCard as GalleryExampleJson),
  toDemo('user-profile', userProfile as GalleryExampleJson),
  toDemo('login-form', loginForm as GalleryExampleJson),
  toDemo(
    'notification-permission',
    notificationPermission as GalleryExampleJson,
  ),
  toDemo('purchase-complete', purchaseComplete as GalleryExampleJson),
  toDemo('chat-message', chatMessage as GalleryExampleJson),
  toDemo('coffee-order', coffeeOrder as GalleryExampleJson),
  toDemo('sports-player', sportsPlayer as GalleryExampleJson),
  toDemo('account-balance', accountBalance as GalleryExampleJson),
  toDemo('workout-summary', workoutSummary as GalleryExampleJson),
  toDemo('event-detail', eventDetail as GalleryExampleJson),
  toDemo('track-list', trackList as GalleryExampleJson),
  toDemo('software-purchase', softwarePurchase as GalleryExampleJson),
  toDemo('restaurant-card', restaurantCard as GalleryExampleJson),
  toDemo('shipping-status', shippingStatus as GalleryExampleJson),
  toDemo('credit-card', creditCard as GalleryExampleJson),
  toDemo('step-counter', stepCounter as GalleryExampleJson),
  toDemo('recipe-card', recipeCard as GalleryExampleJson),
  toDemo('contact-card', contactCard as GalleryExampleJson),
  toDemo('podcast-episode', podcastEpisode as GalleryExampleJson),
  toDemo('stats-card', statsCard as GalleryExampleJson),
  toDemo('countdown-timer', countdownTimer as GalleryExampleJson),
  toDemo('movie-card', movieCard as GalleryExampleJson),
  toDemo(
    'live-invitation-builder',
    liveInvitationBuilder as GalleryExampleJson,
  ),
  toDemo('incremental-dashboard', incrementalDashboard as GalleryExampleJson),
  toDemo(
    'advanced-form-validator',
    advancedFormValidator as GalleryExampleJson,
  ),
  toDemo('financial-data-grid', financialDataGrid as GalleryExampleJson),
  toDemo('child-list-template', childListTemplate as GalleryExampleJson),
  toDemo('markdown-text', markdownText as GalleryExampleJson),
] as const;
