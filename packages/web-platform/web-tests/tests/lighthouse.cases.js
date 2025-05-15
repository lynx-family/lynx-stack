export default [
  {
    'matchingUrlPattern': '/web-element-tests/performance/x-text-large.html',
    'assertions': {
      'categories:performance': [
        'error',
        {
          'minScore': 0.99,
        },
      ],
      'first-contentful-paint': [
        'error',
        {
          'maxNumericValue': 1000,
        },
      ],
      'largest-contentful-paint': [
        'error',
        {
          'maxNumericValue': 1000,
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
          'minScore': 0.99,
        },
      ],
      'first-contentful-paint': [
        'error',
        {
          'maxNumericValue': 1500,
        },
      ],
      'largest-contentful-paint': [
        'error',
        {
          'maxNumericValue': 1500,
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
          'minScore': 0.80,
        },
      ],
      'speed-index': [
        'error',
        {
          'maxNumericValue': 1500,
        },
      ],
    },
  },
];
