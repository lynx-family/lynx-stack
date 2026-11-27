// This module declines hot updates, so an edit to it cannot be applied to a
// running card and the card is reloaded instead.
export const greeting = 'Hello';

if (import.meta.webpackHot) {
  import.meta.webpackHot.decline();
}
