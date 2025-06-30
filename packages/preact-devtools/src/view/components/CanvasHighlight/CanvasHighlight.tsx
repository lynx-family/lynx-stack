import { h } from 'preact';
import { useRef } from 'preact/hooks';
import { useResize } from '../utils';
import s from './CanvasHighlight.module.css';

export function CanvasHighlight() {
  const ref = useRef<HTMLCanvasElement>(null);

  useResize(() => {
    if (ref.current) {
      ref.current.width = window.innerWidth;
      ref.current.height = window.innerHeight;
    }
  }, []);

  return (
    <canvas
      class={s.root}
      ref={ref}
      width={window.innerWidth}
      height={window.innerHeight}
    />
  );
}
