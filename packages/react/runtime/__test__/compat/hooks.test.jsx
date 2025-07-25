import { describe, expect, it, vi } from 'vitest';
import { useTransition, startTransition } from '../../compat';

describe('useTransition', () => {
  it('should return an array with two elements', () => {
    const result = useTransition();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
  });

  it('should return false as the first element', () => {
    const [isPending] = useTransition();
    expect(isPending).toBe(false);
  });

  it('should return a function as the second element', () => {
    const [, transition] = useTransition();
    expect(typeof transition).toBe('function');
  });

  it('should return startTransition as the second element', () => {
    const [, transition] = useTransition();
    expect(transition).toBe(startTransition);
  });
});

describe('startTransition', () => {
  it('should be a function', () => {
    expect(typeof startTransition).toBe('function');
  });

  it('should call the callback function', () => {
    const mockCallback = vi.fn();
    startTransition(mockCallback);
    expect(mockCallback).toHaveBeenCalled();
  });

  it('should call the callback function immediately', () => {
    let called = false;
    startTransition(() => {
      called = true;
    });
    expect(called).toBe(true);
  });
});
