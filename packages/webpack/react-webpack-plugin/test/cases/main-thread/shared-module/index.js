/// <reference types="vitest/globals" />
import { SHARED_MARKER, shout } from './shared.js' with { runtime: 'shared' };

function onTap(event) {
  'main thread';
  event.target.setAttribute('text', shout(SHARED_MARKER));
}

it('keeps the shared module usable on the background', () => {
  expect(shout(SHARED_MARKER)).toBe('shared-module-marker!');
  expect(typeof onTap).toBe('object');
});
