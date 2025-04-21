export default [
  {
    'matchingUrlPattern': '/web-element-tests/performance/x-text-10000.html',
    'assertions': {
      'categories:performance': [
        'error',
        {
          'minScore': 0.73,
        },
      ],
      'first-contentful-paint': [
        'error',
        {
          'maxNumericValue': 900,
        },
      ],
      'total-blocking-time': [
        'error',
        {
          'maxNumericValue': 1300,
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
          'minScore': 0.85,
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
          'maxNumericValue': 650,
        },
      ],
    },
  },
];
