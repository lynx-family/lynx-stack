import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { useStore } from '../store/react-bindings';

export function ThemeSwitcher() {
  const store = useStore();
  let theme = store.theme.value;
  if (theme === 'auto') {
    theme = matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (ref.current) {
      const doc = ref.current.ownerDocument!;
      doc.body.classList.remove('auto', 'light', 'dark');
      doc.body.classList.add(theme);
    }
  }, [theme, ref.current]);

  return <div ref={ref} style='display: none' />;
}
