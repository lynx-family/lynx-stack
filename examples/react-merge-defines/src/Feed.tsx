import type { MainThread } from '@lynx-js/types';

const articles = [
  {
    title: 'Rendered by the background thread',
    body: 'This card is not part of the main-thread build at all.',
  },
  {
    title: 'Recovered from the merged definitions',
    body:
      'Its snapshot definition was collected while compiling the background thread.',
  },
  {
    title: 'Tap me — this handler is a merged worklet',
    body:
      'The tap handler runs on the main thread; its worklet definition was merged the same way.',
  },
];

function highlight(e: MainThread.TouchEvent) {
  'main thread';
  e.currentTarget.setStyleProperties({
    'background-color': 'rgba(94, 234, 149, 0.25)',
    transform: 'scale(0.97)',
  });
}

export function Feed() {
  return (
    <view className='Feed'>
      {articles.map(article => (
        <view
          className='Card'
          key={article.title}
          main-thread:bindtap={highlight}
        >
          <text className='Card__title'>{article.title}</text>
          <text className='Card__body'>{article.body}</text>
        </view>
      ))}
    </view>
  );
}
