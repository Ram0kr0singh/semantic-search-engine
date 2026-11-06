import type { SearchResponse } from './api';

/**
 * Returns a Set of document IDs present in `current` results that do not appear
 * in `other` results.
 *
 * If either column has not yet loaded results (e.g. loading or error state),
 * returns an empty Set to avoid false-positive badges during partial loads.
 */
export function onlyHereIds(
  current: SearchResponse | null | undefined,
  other: SearchResponse | null | undefined
): Set<string> {
  if (!current || !Array.isArray(current.results) || !other || !Array.isArray(other.results)) {
    return new Set<string>();
  }

  const otherIds = new Set(other.results.map((item) => item.id));
  return new Set(
    current.results
      .filter((item) => item.id && !otherIds.has(item.id))
      .map((item) => item.id)
  );
}
