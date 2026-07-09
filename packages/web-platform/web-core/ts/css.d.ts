declare module '*.css';

declare module '*.css?inline' {
  const content: string;
  export default content;
}
