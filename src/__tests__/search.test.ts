import { describe, it, expect } from 'vitest';
import { createSearcher, fuzzySearch } from '../search.js';

describe('fuzzySearch', () => {
  const items = [
    { name: 'Account' },
    { name: 'Contact' },
    { name: 'Account.Industry' },
    { name: 'Account.Name' },
    { name: 'Opportunity' },
    { name: 'Custom_Object__c' },
  ];

  it('should return all items for empty query', () => {
    const searcher = createSearcher(items, ['name']);
    const results = fuzzySearch(searcher, '');
    expect(results.length).toBe(items.length);
  });

  it('should find exact matches', () => {
    const searcher = createSearcher(items, ['name']);
    const results = fuzzySearch(searcher, 'Account');
    expect(results[0].name).toBe('Account');
  });

  it('should find fuzzy matches', () => {
    const searcher = createSearcher(items, ['name']);
    const results = fuzzySearch(searcher, 'Acc');
    expect(results.some((r) => r.name === 'Account')).toBe(true);
  });

  it('should find field matches', () => {
    const searcher = createSearcher(items, ['name']);
    const results = fuzzySearch(searcher, 'Industry');
    expect(results.some((r) => r.name === 'Account.Industry')).toBe(true);
  });
});
