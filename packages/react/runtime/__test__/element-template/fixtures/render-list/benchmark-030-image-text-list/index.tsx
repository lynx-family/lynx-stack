const posts = [
  {
    id: 1,
    title: 'Card one',
    likes: 1.2,
    coverImage: 'https://example.com/cover-1.png',
    content: 'First benchmark list card',
    authorName: 'Ada',
    commentCount: 20,
    creationDate: '2025-01-01',
    shareCount: 50,
  },
  {
    id: 2,
    title: 'Card two',
    likes: 2.5,
    coverImage: 'https://example.com/cover-2.png',
    content: 'Second benchmark list card',
    authorName: 'Linus',
    commentCount: 18,
    creationDate: '2025-01-02',
    shareCount: 35,
  },
  {
    id: 3,
    title: 'Card three',
    likes: 3.1,
    coverImage: 'https://example.com/cover-3.png',
    content: 'Third benchmark list card',
    authorName: 'Grace',
    commentCount: 33,
    creationDate: '2025-01-03',
    shareCount: 62,
  },
];

export function App() {
  const renderCard1 = (card) => (
    <list-item item-key={card.id.toString()}>
      <view className='card'>
        <view className='card1-container'>
          <view className='card1-left-container'>
            <text className='card1-title'>{card.title}</text>
            <view className='card1-bottom'>
              <text className='card1-search-red'>Search</text>
              <text className='card1-search'>{`${card.likes} million people are searching`}</text>
            </view>
          </view>
          <image
            src={card.coverImage}
            alt='Card Header'
            className='card1-image'
            mode='aspectFill'
            downsampling={true}
          />
        </view>
      </view>
    </list-item>
  );

  const renderCard2 = (card) => (
    <list-item item-key={card.id.toString()}>
      <view className='card'>
        <view className='card2-container'>
          <text className='card2-title'>{card.content}</text>
          <image
            src={card.coverImage}
            alt='Card Header'
            className='card2-image'
            mode='aspectFill'
            downsampling={true}
          />
          <text className='card2-bottom'>
            {`${card.authorName} ${card.commentCount} comments ${card.creationDate}`}
          </text>
        </view>
      </view>
    </list-item>
  );

  const renderCard3 = (card) => {
    const images = [card.coverImage, card.coverImage, card.coverImage];
    return (
      <list-item item-key={card.id.toString()}>
        <view className='card'>
          <view className='card2-container'>
            <text className='card2-title'>{card.content}</text>
            <view className='card3-images'>
              {images.map((image, index) => (
                <image
                  key={index}
                  src={image}
                  alt='Card Header'
                  className='card3-image'
                  mode='aspectFill'
                  downsampling={true}
                />
              ))}
            </view>
            <text className='card2-bottom'>{`${card.shareCount} shares ${card.creationDate}`}</text>
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
      {posts.map((post, index) => {
        if (index % 3 === 0) {
          return renderCard1(post);
        }
        if (index % 3 === 1) {
          return renderCard2(post);
        }
        return renderCard3(post);
      })}
    </list>
  );
}
