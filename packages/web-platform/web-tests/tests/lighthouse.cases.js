export default [
  {
    'matchingUrlPattern': '/web-element-tests/performance/x-text-10000.html',
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
          'maxNumericValue': 300,
        },
      ],
    },
  },
  {
    'matchingUrlPattern': '/web-element-tests/performance/raw-text-3000.html',
    'assertions': {
      'categories:performance': [
        'error',
        {
          'minScore': 0.81,
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
          'maxNumericValue': 750,
        },
      ],
    },
  },
];
