const STORAGE_KEY = 'lynx-repl-code';

type CodeState = {
  mainThread: string;
  background: string;
  css: string;
};

export function saveToLocalStorage(code: CodeState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(code));
  } catch {
    // Silently ignore quota errors
  }
}

export function loadFromLocalStorage(): CodeState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CodeState;
    if (typeof parsed.mainThread === 'string') {
      return {
        mainThread: parsed.mainThread,
        background: parsed.background ?? '',
        css: parsed.css ?? '',
      };
    }
  } catch {
    // Corrupted data — ignore
  }
  return null;
}

export function clearLocalStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silently ignore
  }
}
