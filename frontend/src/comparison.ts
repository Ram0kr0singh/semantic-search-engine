import type { SearchResponse } from './api'

export function onlyHereIds(left: SearchResponse | null, right: SearchResponse | null) {
  const rightIds = new Set(right?.results.map((item) => item.id) ?? [])
  return new Set((left?.results ?? []).filter((item) => !rightIds.has(item.id)).map((item) => item.id))
}
