import { InvertedIndex } from "./inverted-index";

export class SearchEngine<T> {
  private index: InvertedIndex<T>;
  private dataStore: Map<T, any>;

  constructor() {
    this.index = new InvertedIndex<T>();
    this.dataStore = new Map();
  }

  // Index an item.
  add(id: T, searchText: string, originalObject?: any): void {
    this.index.insert(id, searchText);
    if (originalObject !== undefined) {
      this.dataStore.set(id, originalObject);
    }
  }

  // Search for items.
  search(query: string): any[] {
    const results = this.index.search(query);
    
    // If we stored original objects, return those
    if (this.dataStore.size > 0) {
      return results
        .map((id) => this.dataStore.get(id))
        .filter((item) => item !== undefined);
    }
    
    // Otherwise return the IDs
    return results;
  }
  
  // Helper to bulk index an array of objects.
  static fromArray<T>(items: T[], idKey: keyof T, searchKeys: (keyof T)[]): SearchEngine<T[keyof T]> {
      const engine = new SearchEngine<T[keyof T]>();
      for (const item of items) {
          const id = item[idKey];
          const text = searchKeys.map(k => String(item[k])).join(" ");
          engine.add(id, text, item);
      }
      return engine;
  }
}
