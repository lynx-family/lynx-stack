import { act, renderHook } from '@lynx-js/react/testing-library';
import { useCounter } from '../src/useCounter.js';

describe('library example', () => {
  it('updates hook state', () => {
    const { result } = renderHook(() => useCounter(2));

    expect(result.current.count).toBe(2);

    act(() => {
      result.current.inc();
      result.current.inc();
      result.current.dec();
    });

    expect(result.current.count).toBe(3);
  });
});
