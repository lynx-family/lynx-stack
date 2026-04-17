const posts = [
  {
    data: {
      id: 1,
      coverImage: 'https://example.com/cover-1.png',
      authorName: 'Ada',
      likes: 1.2,
      commentCount: 30,
    },
  },
  {
    data: {
      id: 2,
      coverImage: 'https://example.com/cover-2.png',
      authorName: 'Linus',
      likes: 2.4,
      commentCount: 28,
    },
  },
  {
    data: {
      id: 3,
      coverImage: 'https://example.com/cover-3.png',
      authorName: 'Grace',
      likes: 3.6,
      commentCount: 45,
    },
  },
];

export function App() {
  const renderCard = (card, index) => {
    let indexColor;
    if (index === 0) {
      indexColor = '#F7283D';
    } else if (index === 1) {
      indexColor = '#F76A4F';
    } else if (index === 2) {
      indexColor = '#F4CB5F';
    } else {
      indexColor = '#AEADB2';
    }

    return (
      <list-item item-key={card.id.toString()}>
        <view className='card'>
          <view className='card-container'>
            <view className='card-left-container'>
              <text className='card-index' style={{ color: indexColor }}>
                {index + 1}
              </text>
              <image
                className='avatar'
                src={card.coverImage}
                alt='Card Header'
                mode='aspectFill'
                downsampling={true}
              />
              <view className='user-container'>
                <text className='user-name'>{card.authorName}</text>
                <text className='user-subtitle'>{`${card.likes} million people are watching`}</text>
              </view>
            </view>
            <text className='card-left-title'>{`${card.commentCount} M+`}</text>
          </view>
        </view>
      </list-item>
    );
  };

  return (
    <list
      list-type='single'
      style={{
        height: '100%',
        width: '100%',
      }}
      custom-list-name='list-container'
      experimental-disable-platform-implementation={true}
    >
      {posts.map((post, index) => renderCard(post.data, index))}
    </list>
  );
}
