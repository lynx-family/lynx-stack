import { type TestingLibraryMatchers as _TLM } from './matchers';

interface MatcherReturnType {
  pass: boolean;
  message: () => string;
}

interface OverloadedMatchers {
}

declare namespace matchersStandalone {
  type MatchersStandalone =
    & {
      [T in keyof _TLM<any, void>]: (
        expected: any,
        ...rest: Parameters<_TLM<any, void>[T]>
      ) => MatcherReturnType;
    }
    & OverloadedMatchers;

  type TestingLibraryMatchers<E, R> = _TLM<E, R>;
}

declare const matchersStandalone:
  & matchersStandalone.MatchersStandalone
  & Record<string, any>;
export = matchersStandalone;
