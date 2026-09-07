import type { SearchableItem } from "@keiri/types";
import { useEffect, useState } from "react";

import { advancedFuzzySearchWasm } from "./utils";

/**
 * A hook that performs fuzzy search on a list of items using Rust/WASM.
 * @param items The list of items to search
 * @param query The search query
 * @param selector A function to get the searchable fields from an item
 * @param threshold Minimum score (0-1) to include an item
 */
export function useFuzzySearch<T>(
  items: T[] | undefined,
  query: string,
  selector: (item: T) => { value: string; weight: number }[],
  threshold: number = 0.5,
) {
  const [results, setFilteredResults] = useState<T[]>([]);

  useEffect(() => {
    if (!items) {
      setFilteredResults([]);
      return;
    }

    if (!query.trim()) {
      setFilteredResults(items);
      return;
    }

    async function performSearch() {
      if (!items) return;

      const searchableItems: SearchableItem[] = items.map((item) => ({
        fields: selector(item),
      }));

      const batchResults = advancedFuzzySearchWasm(query, searchableItems, threshold);

      const filtered = batchResults.map((res) => items[res.index]);

      setFilteredResults(filtered);
    }

    void performSearch();
  }, [items, query, selector, threshold]);

  return results;
}
