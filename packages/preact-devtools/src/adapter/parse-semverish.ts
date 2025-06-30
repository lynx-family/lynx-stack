const MAJOR = 1;
const MINOR = 2;
const PATCH = 3;
const PRERELEASE = 5;
const PRERELEASE_TAG = 5;
const PRERELEASE_VERSION = 6;
const REGEXP_SEMVERISH = /^(\d+)\.(\d+)\.(\d+)(-([\w_-]+)(?:\.(\d+))?)?$/i;

/**
 * semver-ish parsing based on https://github.com/npm/node-semver/blob/master/semver.js
 *
 * @param version Version to parse
 * @param allowPreRelease Flag to indicate whether pre-releases should be allowed & parsed (e.g. -rc.1)
 */
export default function parseSemverish(
  version: string,
): {
  major: number;
  minor: number;
  patch: number;
  preRelease?: { tag: string; version: number };
} | null {
  const match = version.match(REGEXP_SEMVERISH);

  if (match) {
    let preRelease = undefined;
    if (match[PRERELEASE]) {
      preRelease = {
        tag: match[PRERELEASE_TAG],
        version: match[PRERELEASE_VERSION] !== undefined
          ? +match[PRERELEASE_VERSION]
          : -1,
      };
    }

    return {
      major: +match[MAJOR],
      minor: +match[MINOR],
      patch: +match[PATCH],
      preRelease,
    };
  }

  return null;
}
