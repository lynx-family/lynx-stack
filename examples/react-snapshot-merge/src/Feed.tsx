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
    title: 'No more "Snapshot not found"',
    body: 'The main thread creates it on demand when the patch arrives.',
  },
];

export function Feed() {
  return (
    <view className='Feed'>
      {articles.map(article => (
        <view className='Card' key={article.title}>
          <text className='Card__title'>{article.title}</text>
          <text className='Card__body'>{article.body}</text>
        </view>
      ))}
    </view>
  );
}
