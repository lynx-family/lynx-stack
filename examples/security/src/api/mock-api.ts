// Mock API implementation for CSRF demo
// This simulates a server API that checks CSRF tokens

// Define response type
export interface ApiResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Handles mock API request with CSRF validation
 * @param url API endpoint
 * @param token Token from request headers/body
 * @param validToken The valid token to check against
 * @returns Promise resolving to ApiResponse
 */
export const handleMockApiRequest = async (
  url: string,
  token: string,
  validToken: string,
): Promise<ApiResponse> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));

  // Validate the token
  if (token === validToken) {
    return {
      success: true,
      message: 'Request successful! CSRF token was valid.',
      data: {
        timestamp: new Date().toISOString(),
        endpoint: url,
        tokenValid: true,
      },
    };
  }
  return {
    success: false,
    message: 'Request rejected! Invalid CSRF token.',
    data: {
      timestamp: new Date().toISOString(),
      endpoint: url,
      tokenValid: false,
    },
  };
};

export const processDangerousInput = (
  input: string,
  xssProtection: boolean,
) => {
  if (xssProtection) {
    // XSS protected version - sanitizes input
    return {
      success: true,
      message: 'Input processed safely',
      result: {
        original: input,
        processed: sanitizeInput(input),
        safe: true,
      },
    };
  }
  return {
    success: false,
    message: 'WARNING: XSS Protection disabled!',
    result: {
      original: input,
      processed: input,
      safe: false,
    },
  };
};

// Simple sanitization function - removes HTML tags
function sanitizeInput(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}
