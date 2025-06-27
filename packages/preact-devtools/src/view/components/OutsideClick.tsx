import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

export interface Props {
  onClick: () => void;
  children: any;
  class?: string;
  style?: string | Record<string, any>;
}

export function OutsideClick(props: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const listener = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as any)) {
        props.onClick();
      }
    };

    const root = ref.current!.getRootNode() as HTMLElement;
    root.addEventListener('click', listener);
    return () => root.removeEventListener('click', listener);
  }, [props.children, ref.current]);

  return (
    <div ref={ref} class={props.class} style={props.style}>
      {props.children}
    </div>
  );
}
