export {};
declare global {
  interface Window {
    info: {
      sdkVersion: string;
      App: string;
    };
    compareVersions: (a: string, b: string) => number;
  }
}
