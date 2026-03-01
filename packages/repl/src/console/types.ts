export type ConsoleLevel = 'log' | 'warn' | 'error' | 'info' | 'debug';
export type ConsoleSource = 'main-thread' | 'background';

export interface ConsoleEntry {
  id: number;
  level: ConsoleLevel;
  source: ConsoleSource;
  args: string[];
  timestamp: number;
}

export interface ConsoleMessage {
  level: ConsoleLevel;
  source: ConsoleSource;
  args: string[];
  timestamp: number;
}
