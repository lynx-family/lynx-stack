import { h, Fragment } from 'preact';
import {
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
} from 'preact/hooks';

const sizerStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  visibility: 'hidden',
  height: 0,
  whiteSpace: 'pre',
};

export interface Props {
  value?: string;
  class?: string;
  onChange?(value: string): void;
  name?: string;
}

export function AutoSizeInput(props: Props) {
  const { onChange, ...rest } = props;
  const [width, setWidth] = useState(1);
  const [value, setValue] = useState(rest.value);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Match font styles
    const input = inputRef.current;
    const inputStyle = input && window.getComputedStyle(input);
    if (inputStyle && ref.current) {
      const sizer = ref.current;
      sizer.style.fontSize = inputStyle.fontSize;
      sizer.style.fontFamily = inputStyle.fontFamily;
      sizer.style.fontWeight = inputStyle.fontWeight;
      sizer.style.fontStyle = inputStyle.fontStyle;
      sizer.style.letterSpacing = inputStyle.letterSpacing;
      sizer.style.paddingTop = inputStyle.paddingTop;
      sizer.style.paddingBottom = inputStyle.paddingBottom;
      sizer.style.paddingLeft = inputStyle.paddingLeft;
      sizer.style.paddingRight = inputStyle.paddingRight;
    }
  }, []);

  const resize = useCallback(() => {
    if (ref.current) {
      // +1 to avoid flickering
      const nextWidth = ref.current.scrollWidth + 1;
      if (nextWidth !== width) {
        setWidth(nextWidth);
      }
    }
  }, [ref.current]);

  useLayoutEffect(resize, [value]);
  useEffect(resize, [value]);

  return (
    <Fragment>
      <input
        {...rest}
        type='text'
        ref={inputRef}
        value={value}
        style={`width: ${width}px; min-width: 0`}
        onInput={e => setValue((e.target as any).value)}
        onBlur={e => onChange && onChange((e.target as any).value)}
      />
      <div ref={ref} style={sizerStyle}>
        {value}
      </div>
    </Fragment>
  );
}
