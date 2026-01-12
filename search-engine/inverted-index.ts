
export class InvertedIndex<T> {
  private index: Map<string, Set<T>>;
  private items: Map<T, string>;

  constructor() {
    this.index = new Map();
    this.items = new Map();
  }

  // Tokenizes text into unique lowercase words, removing common stop words and punctuation.
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[^a-z0-9]+/) // Split by non-alphanumeric characters
      .filter((token) => token.length > 2) // Ignore short words
      .filter((token) => !STOP_WORDS.has(token)); // Ignore stop words
  }

  // Adds an item to the index.
  insert(id: T, text: string): void {
    const tokens = this.tokenize(text);
    for (const token of tokens) {
      if (!this.index.has(token)) {
        this.index.set(token, new Set());
      }
      this.index.get(token)!.add(id);
    }
  }

  // Searches for items matching the query string.
  // Uses intersection for multi-word queries (AND logic).
  search(query: string): T[] {
    const tokens = this.tokenize(query);
    if (tokens.length === 0) return [];

    // Get the set of matches for the first token
    let result = this.index.get(tokens[0]);
    if (!result) return [];

    // Start with a copy of the first result set
    let intersection = new Set(result);

    // Intersect with matches for subsequent tokens
    for (let i = 1; i < tokens.length; i++) {
      const tokenMatches = this.index.get(tokens[i]);
      if (!tokenMatches) {
        // If any token has no matches, the intersection is empty (AND logic)
        return [];
      }
      
      // Filter intersection to keep only items present in the current token's matches
      for (const id of intersection) {
        if (!tokenMatches.has(id)) {
          intersection.delete(id);
        }
      }
      
      if (intersection.size === 0) return [];
    }

    return Array.from(intersection);
  }
}

const STOP_WORDS = new Set([
  "the", "of", "and", "a", "to", "in", "is", "you", "that", "it", "he", "was", "for", "on", "are", "as", "with", "his", "they", "i", "at", "be", "this", "have", "from", "or", "one", "had", "by", "word", "but", "not", "what", "all", "were", "we", "when", "your", "can", "said", "there", "use", "an", "each", "which", "she", "do", "how", "their", "if", "will", "up", "other", "about", "out", "many", "then", "them", "these", "so", "some", "her", "would", "make", "like", "him", "into", "time", "has", "look", "two", "more", "write", "go", "see", "number", "no", "way", "could", "people", "my", "than", "first", "water", "been", "call", "who", "oil", "its", "now", "find"
]);
