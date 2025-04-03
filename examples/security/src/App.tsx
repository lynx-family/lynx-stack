import { useCallback, useEffect, useState } from '@lynx-js/react';
import './App.css';

/**
 * Security Demo App - Lynx Compatible Version
 *
 * This component demonstrates core web security features:
 * - Content Security Policy (CSP) with nonce validation
 * - CSRF protection with tokens
 * - Input sanitization for XSS prevention
 *
 * Note: This implementation is specifically designed to work
 * in the Lynx runtime environment.
 */
export default function App() {
  // Create mock security features for Lynx compatibility
  const security = {
    createNonce: () =>
      `mock-nonce-${Math.random().toString(36).substring(2, 10)}`,
    getCsrfToken: () =>
      `mock-csrf-${Math.random().toString(36).substring(2, 10)}`,
    sanitizeHtml: (html: string) => html.replace(/<[^>]*>/g, ''),
  };

  const [securityFeature, setSecurityFeature] = useState('csp');
  const [demoMessage, setDemoMessage] = useState(
    'Welcome to the Security Demo',
  );
  const [nonce, setNonce] = useState('');
  const [csrfToken, setCsrfToken] = useState('');

  // Initialize security values
  useEffect(() => {
    const generatedNonce = security.createNonce();
    setNonce(generatedNonce);

    const generatedToken = security.getCsrfToken();
    setCsrfToken(generatedToken);

    setDemoMessage('App initialized with security features');
  }, []);

  // CSP demo handlers
  const showCSP = useCallback(() => {
    setSecurityFeature('csp');
    setDemoMessage(`CSP Demo: Current Nonce = ${nonce}`);
  }, [nonce]);

  // CSRF demo handlers
  const showCSRF = useCallback(() => {
    setSecurityFeature('csrf');
    setDemoMessage(`CSRF Demo: Token = ${csrfToken}`);
  }, [csrfToken]);

  // Sanitization demo handler
  const showSanitize = useCallback(() => {
    setSecurityFeature('sanitize');
    setDemoMessage('Sanitization Demo Ready');
  }, []);

  // Demonstrate CSP script execution with/without nonce
  const executeScript = useCallback((isValid: boolean) => {
    if (isValid) {
      setDemoMessage(
        `Safe Script (with nonce ${
          nonce.substring(0, 10)
        }...) would execute in browser`,
      );
    } else {
      setDemoMessage('Unsafe Script (without nonce) would be blocked by CSP');
    }
  }, [nonce]);

  // Demonstrate CSRF token validation
  const makeRequest = useCallback((isValid: boolean) => {
    if (isValid) {
      setDemoMessage(
        `Valid request with token ${
          csrfToken.substring(0, 10)
        }... was successful`,
      );
    } else {
      setDemoMessage('Invalid request without proper CSRF token was blocked');
    }
  }, [csrfToken]);

  // Demonstrate input sanitization with different XSS vectors
  const sanitizeExample = useCallback((example: number) => {
    let input = '<script>alert("XSS")</script>';

    if (example === 2) {
      input = '<img src="x" onerror="alert(\'XSS\')">';
    } else if (example === 3) {
      input = '<a href="javascript:alert(\'XSS\')">Click me</a>';
    }

    const sanitized = security.sanitizeHtml(input);
    setDemoMessage(`Input: ${input}\n\nSanitized: ${sanitized}`);
  }, [security]);

  return (
    <view className='App'>
      <view className='Header'>
        <text className='Title'>Security Demo</text>
        <text className='Subtitle'>Lynx Edition</text>
      </view>

      {/* Navigation buttons - using standard onClick for Lynx compatibility */}
      <view className='ButtonContainer'>
        <view className='Button' onClick={showCSP}>
          <text>CSP Demo</text>
        </view>
        <view className='Button' onClick={showCSRF}>
          <text>CSRF Demo</text>
        </view>
        <view className='Button' onClick={showSanitize}>
          <text>Sanitize Demo</text>
        </view>
      </view>

      {/* Demo sections - only one shown at a time based on selected feature */}
      <view className='Section'>
        {securityFeature === 'csp' && (
          <view>
            <text className='SectionTitle'>Content Security Policy</text>
            <text className='Description'>
              CSP controls which scripts can execute
            </text>
            <view className='ButtonContainer'>
              <view className='Button' onClick={() => executeScript(true)}>
                <text>Safe Script</text>
              </view>
              <view className='Button' onClick={() => executeScript(false)}>
                <text>Unsafe Script</text>
              </view>
            </view>
          </view>
        )}

        {securityFeature === 'csrf' && (
          <view>
            <text className='SectionTitle'>CSRF Protection</text>
            <text className='Description'>
              Prevents cross-site request forgery
            </text>
            <view className='ButtonContainer'>
              <view className='Button' onClick={() => makeRequest(true)}>
                <text>Valid Request</text>
              </view>
              <view className='Button' onClick={() => makeRequest(false)}>
                <text>Invalid Request</text>
              </view>
            </view>
          </view>
        )}

        {securityFeature === 'sanitize' && (
          <view>
            <text className='SectionTitle'>Input Sanitization</text>
            <text className='Description'>
              Cleans potentially dangerous input
            </text>
            <view className='ButtonContainer'>
              <view className='Button' onClick={() => sanitizeExample(1)}>
                <text>Script Example</text>
              </view>
              <view className='Button' onClick={() => sanitizeExample(2)}>
                <text>Img Example</text>
              </view>
              <view className='Button' onClick={() => sanitizeExample(3)}>
                <text>Link Example</text>
              </view>
            </view>
          </view>
        )}
      </view>

      {/* Results display section - shows outcome of security operations */}
      <view className='Section'>
        <text className='SectionTitle'>Results</text>
        <view className='ResultContainer'>
          <text className='ResultCode'>{demoMessage}</text>
        </view>
      </view>
    </view>
  );
}
