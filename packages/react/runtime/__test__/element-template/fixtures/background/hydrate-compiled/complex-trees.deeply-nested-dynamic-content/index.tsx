import type { ComponentChildren } from 'preact';

interface AppProps {
  showExtra?: boolean;
  title?: string;
}

function Header({ title }: { title: string }) {
  return <text>{title}</text>;
}

function Content({ children }: { children?: ComponentChildren }) {
  return <view>{children}</view>;
}

function Card({ children }: { children?: ComponentChildren }) {
  return <view>{children}</view>;
}

export function App({ showExtra = false, title = 'Main' }: AppProps) {
  return (
    <Card>
      <Header title={title} />
      <Content>
        <text>A</text>
        {showExtra ? <text>B</text> : null}
      </Content>
    </Card>
  );
}

export const mainProps = { title: 'Main', showExtra: false };
export const backgroundProps = { title: 'BG', showExtra: true };
