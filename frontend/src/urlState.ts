export type SearchMode = 'compare' | 'search';
export type AppView = SearchMode | 'eval';

export type ResultCount = 5 | 10 | 20;

export function writeUrlState(replace = false): void {
  // Searches are intentionally not encoded in the address bar. A query can be
  // personal or simply long, and a clean address makes returning to the site
  // feel like starting a new search rather than resuming an old one.
  const newUrl = window.location.pathname;
  if (replace) {
    window.history.replaceState(null, '', newUrl);
  } else {
    window.history.pushState(null, '', newUrl);
  }
}
