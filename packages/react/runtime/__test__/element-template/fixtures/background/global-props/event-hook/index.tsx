import {
  GlobalPropsConsumer,
  GlobalPropsProvider,
  useGlobalProps,
  useGlobalPropsChanged,
} from '@lynx-js/react/element-template';
import type { GlobalProps } from '@lynx-js/react/element-template';

interface ThemeGlobalProps extends GlobalProps {
  theme?: string;
}

interface AppProps {
  onChanged?: (data: ThemeGlobalProps) => void;
}

export function App({ onChanged }: AppProps): JSX.Element {
  const globalProps = useGlobalProps() as ThemeGlobalProps;
  useGlobalPropsChanged(data => {
    onChanged?.(data as ThemeGlobalProps);
  });

  return (
    <GlobalPropsProvider>
      <GlobalPropsConsumer>
        {provided => (
          <view>
            <text>{`${globalProps.theme}:${(provided as ThemeGlobalProps).theme}`}</text>
          </view>
        )}
      </GlobalPropsConsumer>
    </GlobalPropsProvider>
  );
}
