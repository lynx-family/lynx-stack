import { readValue } from 'shared-value' with { runtime: 'shared' };

export const sharedValue = () => {
  'main thread';
  return readValue();
};
