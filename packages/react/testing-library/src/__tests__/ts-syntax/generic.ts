// A generic arrow function is only valid when the file is parsed as `.ts`.
// When parsed as `.tsx`, `<T>` is read as the opening tag of a JSX element.
export const identity = <T>(value: T): T => value;
