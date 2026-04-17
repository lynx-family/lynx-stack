const posts = [
  {
    id: 1,
    authorAvatar: 'https://example.com/avatar-1.png',
    authorName: 'Ada',
    liked: true,
    likes: '1.2M',
    tags: ['react', 'lynx'],
    title: 'Waterfall card one',
    content: 'Benchmark waterfall content one',
    creationDate: '2025-01-01',
    coverImage: 'https://example.com/cover-1.png',
  },
  {
    id: 2,
    authorAvatar: 'https://example.com/avatar-2.png',
    authorName: 'Linus',
    liked: false,
    likes: '980K',
    tags: ['et', 'snapshot'],
    title: 'Waterfall card two',
    content: 'Benchmark waterfall content two',
    creationDate: '2025-01-02',
    coverImage: 'https://example.com/cover-2.png',
  },
];

export function App() {
  const renderAuthorInfo = (card) => (
    <view className='author-info'>
      <image
        src={card.authorAvatar}
        alt='Author Avatar'
        className='author-avatar'
        mode='aspectFill'
        downsampling={true}
      />
      <view className='author-text-info'>
        <text className='author-name'>{card.authorName}</text>
      </view>
    </view>
  );

  const HeartIcon = () => <text>❤️</text>;

  const renderCardStats = (card) => (
    <view className='card-stats'>
      <view className={`heart-icon ${card.liked ? 'liked' : ''}`}>
        <HeartIcon />
      </view>
      <text className='likes-count'>{card.likes}</text>
    </view>
  );

  const renderCardBottomInfo = (card) => (
    <view className='card-bottom-info'>
      {renderAuthorInfo(card)}
      {renderCardStats(card)}
    </view>
  );

  const renderCardTags = (card) => (
    <view className='tags-section'>
      {card.tags.map((tag, index) => (
        <text key={index} className='tag'>
          {tag}
        </text>
      ))}
    </view>
  );

  const renderCardBody = (card) => (
    <view className='card-body'>
      <text className='card-title'>{card.title}</text>
      {renderCardBottomInfo(card)}
      {renderCardTags(card)}
      <text className='card-content'>{card.content}</text>
      <text className='creation-date'>Posted on: {card.creationDate}</text>
    </view>
  );

  const renderCard = (card) => (
    <list-item item-key={card.id.toString()}>
      <view className='card'>
        <image
          src={card.coverImage}
          alt='Card Header'
          className='header-image'
          mode='aspectFill'
          downsampling={true}
        />
        {renderCardBody(card)}
      </view>
    </list-item>
  );

  return (
    <list
      list-type='waterfall'
      column-count={2}
      style={{
        height: '100%',
        width: '100%',
      }}
      custom-list-name='list-container'
      experimental-disable-platform-implementation={true}
    >
      {posts.map(post => renderCard(post))}
    </list>
  );
}
