export default [
  {
    'matchingUrlPattern': '/web-element-tests/performance/x-text-large.html',
    'assertions': {
      'categories:performance': [
        'error',
        {
          'minScore': 0.93,
        },
      ],
      'first-contentful-paint': [
        'error',
        {
          'maxNumericValue': 800,
        },
      ],
      'total-blocking-time': [
        'error',
        {
          'maxNumericValue': 350,
        },
      ],
    },
  },
  {
    'matchingUrlPattern': '/web-element-tests/performance/raw-text-large.html',
    'assertions': {
      'categories:performance': [
        'error',
        {
          'minScore': 0.87,
        },
      ],
      'first-contentful-paint': [
        'error',
        {
          'maxNumericValue': 800,
        },
      ],
      'total-blocking-time': [
        'error',
        {
          'maxNumericValue': 500,
        },
      ],
    },
  },
  {
    'matchingUrlPattern':
      '/web-element-tests/performance/x-text-with-font.html',
    'assertions': {
      'categories:performance': [
        'error',
        {
          'minScore': 0.79,
        },
      ],
      'speed-index': [
        'error',
        {
          'maxNumericValue': 550,
        },
      ],
      'total-blocking-time': [
        'error',
        {
          'maxNumericValue': 500,
        },
      ],
    },
  },
];
