import Fuse from 'fuse.js';

export function createSearcher<T>(items: T[], keys: string[]): Fuse<T> {
  return new Fuse(items, {
    keys,
    threshold: 0.4,
    includeScore: true,
  });
}

export function fuzzySearch<T>(searcher: Fuse<T>, query: string): T[] {
  if (!query.trim()) {
    // Return all items when query is empty
    const index = searcher.getIndex() as unknown as { docs: T[] };
    return index.docs;
  }
  return searcher.search(query).map((r) => r.item);
}
