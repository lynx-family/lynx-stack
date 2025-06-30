export function inject(codeOrSrc: string, mode: 'script' | 'code' = 'code') {
  const s = document.createElement('script');
  // This runs before `<head>` is available
  const target = document.head || document.documentElement;
  if (mode === 'code') s.textContent = codeOrSrc;
  else s.src = codeOrSrc;
  target.appendChild(s);
  s.remove();
}

export function injectStyles(href: string) {
  const s = document.createElement('link');
  s.rel = 'stylesheet';
  s.href = href;
  const target = document.head || document.documentElement;
  target.appendChild(s);
}

export function debounce<T extends any[]>(
  callback: (...args: T) => void,
  wait: number,
) {
  let timeout: any = null;
  return (...args: T) => {
    const next = () => callback(...args);
    clearTimeout(timeout);
    timeout = setTimeout(next, wait);
  };
}

export function throttle<T extends any[]>(
  callback: (...args: T) => void,
  wait: number,
) {
  let running = false;
  return (...args: T) => {
    if (!running) {
      callback(...args);
      running = true;
      setTimeout(() => {
        running = false;
        callback(...args);
      }, wait);
    }
  };
}

export function copyToClipboard(text: string) {
  const dom = document.createElement('textarea');
  dom.textContent = text;
  document.body.appendChild(dom);

  dom.select();
  document.execCommand('copy');
  dom.blur();

  document.body.removeChild(dom);
}

export function isFirefox() {
  return navigator.userAgent.indexOf('Firefox') >= 0;
}
