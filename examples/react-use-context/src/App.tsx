import { createContext, useState } from '@lynx-js/react';
import { use } from '@lynx-js/react/compat';

interface Theme {
  name: string;
  fg: string;
  bg: string;
}

const light: Theme = { name: 'light', fg: '#1a1a1a', bg: '#f5f5f7' };
const dark: Theme = { name: 'dark', fg: '#f5f5f7', bg: '#16161a' };

const ThemeContext = createContext<Theme>(light);

// Rendered on the first screen, so `use` runs on the main thread before the
// background runtime has started.
function Title() {
  const theme = use(ThemeContext);
  return (
    <text style={{ color: theme.fg, fontSize: '24px' }}>
      use() on {theme.name}
    </text>
  );
}

function Card({ label }: { label: string }) {
  const theme = use(ThemeContext);
  return (
    <view
      style={{
        marginTop: '12px',
        padding: '16px',
        borderRadius: '12px',
        backgroundColor: theme.name === 'dark' ? '#26262c' : '#ffffff',
      }}
    >
      <text style={{ color: theme.fg }}>{label}</text>
    </view>
  );
}

// Outside every Provider, so `use` falls back to the context default.
function OutsideProvider() {
  const theme = use(ThemeContext);
  return (
    <view
      style={{
        padding: '16px',
        borderRadius: '12px',
        backgroundColor: theme.bg,
      }}
    >
      <text style={{ color: theme.fg }}>
        outside any provider, default: {theme.name}
      </text>
    </view>
  );
}

export function App() {
  const [isDark, setIsDark] = useState(false);
  const theme = isDark ? dark : light;

  return (
    <view style={{ flex: 1, backgroundColor: theme.bg, padding: '40px' }}>
      <ThemeContext.Provider value={theme}>
        <Title />
        <Card label='read through use(), not useContext()' />
        <ThemeContext.Provider value={light}>
          <Card label='nested provider always reads light' />
        </ThemeContext.Provider>
        <view
          bindtap={() => {
            'background-only';
            setIsDark(v => !v);
          }}
          style={{
            marginTop: '20px',
            padding: '16px',
            borderRadius: '12px',
            backgroundColor: '#4f7cff',
          }}
        >
          <text style={{ color: '#fff' }}>toggle theme</text>
        </view>
      </ThemeContext.Provider>
      <view style={{ marginTop: '20px' }}>
        <OutsideProvider />
      </view>
    </view>
  );
}
