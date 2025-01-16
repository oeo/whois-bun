export const CONSONANTS = 'bcdfghjklmnpqrstvwxz'.split('');
export const VOWELS = 'aeiou'.split('');
export const NUMBERS = '0123456789'.split('');
export const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
export const ALL_CHARS = [
  ...LETTERS,
  ...'0123456789',
  '-'
].filter(char => char);

export interface PatternPart {
  type: string;
  value?: string;
  possibilities?: string[];
  isWildcard?: boolean;
}

export const parsePattern = (pattern: string): PatternPart[] => {
  const parts: PatternPart[] = [];
  let currentLiteral = '';

  const processLiteral = () => {
    if (currentLiteral) {
      parts.push({
        type: 'literal',
        value: currentLiteral,
        possibilities: [currentLiteral.toLowerCase()]
      });
      currentLiteral = '';
    }
  };

  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    const lowerChar = char.toLowerCase();
    
    // Handle special pattern characters regardless of case
    if (lowerChar === 'c' || lowerChar === 'v' || lowerChar === 'n' || lowerChar === 'l') {
      processLiteral();
      switch (lowerChar) {
        case 'c':
          parts.push({ type: 'c', possibilities: CONSONANTS });
          break;
        case 'v':
          parts.push({ type: 'v', possibilities: VOWELS });
          break;
        case 'n':
          parts.push({ type: 'n', possibilities: NUMBERS });
          break;
        case 'l':
          parts.push({ type: 'l', possibilities: LETTERS });
          break;
      }
    } else if (char === '_') {
      processLiteral();
      parts.push({
        type: 'wildcard',
        possibilities: ALL_CHARS,
        isWildcard: true
      });
    } else if (char === '-') {
      processLiteral();
      parts.push({ type: char, possibilities: [char] });
    } else {
      // Regular character, add to current literal
      currentLiteral += char;
    }
  }

  processLiteral();
  return parts;
};

export const validatePattern = (pattern: string): string | null => {
  if (!pattern) return 'Pattern cannot be empty';
  if (pattern.includes(' ')) return 'Pattern cannot contain spaces';
  if (pattern.startsWith('-')) {
    return 'Pattern cannot start with hyphen';
  }
  if (pattern.endsWith('-')) {
    return 'Pattern cannot end with hyphen';
  }
  if (pattern.includes('--')) return 'Pattern cannot contain consecutive hyphens';
  
  const validChars = new Set([...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_cvnl']);
  for (const char of pattern) {
    if (!validChars.has(char)) {
      return `Invalid character in pattern: ${char}`;
    }
  }
  
  return null;
};

export const validateExtensions = (extensions: string[]): string | null => {
  if (!extensions.length) return 'At least one extension is required';
  
  for (const ext of extensions) {
    if (!ext.startsWith('.')) return `Extension must start with dot: ${ext}`;
    if (ext.length < 2) return `Extension too short: ${ext}`;
    if (!/^[.a-z0-9]+$/.test(ext)) return `Invalid extension format: ${ext}`;
  }
  
  return null;
};

export const shuffleArray = <T>(array: T[]): T[] => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

export function* generateCombinations(patternParts: PatternPart[]) {
  const totalCombinations = patternParts.reduce((acc, part) => 
    acc * (part.possibilities?.length || 1), 1);

  const indices = Array.from({ length: totalCombinations }, (_, i) => i);
  shuffleArray(indices);

  for (const i of indices) {
    let current = i;
    let result = '';
    let isValid = true;
    let lastChar = '';

    for (let j = 0; j < patternParts.length; j++) {
      const part = patternParts[j];
      const possibilities = part.possibilities!;
      const index = current % possibilities.length;
      const char = possibilities[index];
      
      // Check if this would create an invalid domain
      if (result.length === 0 && (char === '-' || /[0-9]/.test(char))) {
        isValid = false;
        break;
      }

      // Check for sequential hyphens
      if (char === '-' && lastChar === '-') {
        isValid = false;
        break;
      }
      
      result += char;
      lastChar = char;
      current = Math.floor(current / possibilities.length);
    }

    // Skip invalid domain names
    if (!isValid || result.endsWith('-') || /^[0-9]/.test(result)) {
      continue;
    }

    yield result;
  }
}

export interface PatternAnalysis {
  pattern: string;
  extensions: string[];
  combinations: number;
  totalDomains: number;
  parts: PatternPart[];
  comment?: string;
}

export interface DomainHistory {
  [key: string]: {
    checked: boolean;
    available?: boolean;
    last_checked: string;
  };
}

export const countRemainingDomains = (
  pattern: PatternAnalysis,
  history: DomainHistory,
  maxAgeDays: number = 7
): { remaining: number, checked: number } => {
  let remaining = 0;
  let checked = 0;
  const now = Date.now();

  for (const base of generateCombinations(pattern.parts)) {
    if (base.startsWith('-') || base.endsWith('-')) continue;

    for (const ext of pattern.extensions) {
      const domain = base + ext;
      
      if (history[domain]) {
        const lastChecked = new Date(history[domain].last_checked);
        const daysSinceChecked = (now - lastChecked.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceChecked < maxAgeDays) {
          checked++;
          continue;
        }
      }
      
      remaining++;
    }
  }

  return { remaining, checked };
};

export function analyzePattern(entry: { pattern: string, extensions: string[], comment?: string }): PatternAnalysis | string {
  const { pattern, extensions, comment } = entry;

  // Validate pattern
  const validationResult = validatePattern(pattern);
  if (typeof validationResult === 'string') {
    return validationResult;
  }

  // Validate extensions
  const extensionResult = validateExtensions(extensions);
  if (typeof extensionResult === 'string') {
    return extensionResult;
  }

  const parts = parsePattern(pattern);
  const combinations = parts.reduce((acc: number, part: PatternPart) => {
    if (!part.possibilities) return acc;
    return acc * part.possibilities.length;
  }, 1);
  const totalDomains = combinations * extensions.length;

  return {
    pattern,
    extensions,
    combinations,
    totalDomains,
    parts,
    comment
  };
}

export const processPatterns = (input: string) => {
  const results: { pattern: string, extensions: string[], comment?: string }[] = [];
  
  const lines = input.split('\n').map(line => line.trim());
  
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;

    const [content, ...commentParts] = line.split('#');
    const comment = commentParts.join('#').trim();
    
    const parts = content.trim().split(/\s*;\s*/);
    if (!parts[0]) continue;

    const entry: { pattern: string, extensions: string[], comment?: string } = {
      pattern: parts[0],
      extensions: ['.com']
    };

    for (const part of parts.slice(1)) {
      const [key, value] = part.split(/\s*=\s*/);
      if (key && value) {
        switch (key.toLowerCase()) {
          case 'ext':
          case 'extensions':
            entry.extensions = value.split(/\s*,\s*/);
            break;
        }
      }
    }

    if (comment) {
      entry.comment = comment;
    }

    results.push(entry);
  }
  
  return results;
};

export class Bitmap {
  private bits: Uint8Array;
  private size: number;

  constructor(size: number = 1_000_000) {
    this.size = size;
    this.bits = new Uint8Array(Math.ceil(size / 8)).fill(0);
  }

  private hash(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = ((hash << 5) - hash) + value.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % this.size;
  }

  add(value: string): void {
    const index = this.hash(value);
    const byteIndex = Math.floor(index / 8);
    const bitIndex = index % 8;
    this.bits[byteIndex] |= (1 << bitIndex);
  }

  test(value: string): boolean {
    const index = this.hash(value);
    const byteIndex = Math.floor(index / 8);
    const bitIndex = index % 8;
    return !!(this.bits[byteIndex] & (1 << bitIndex));
  }

  serialize(): string {
    return JSON.stringify({
      size: this.size,
      bits: Array.from(this.bits)
    });
  }

  static deserialize(data: string): Bitmap {
    const parsed = JSON.parse(data);
    const bitmap = new Bitmap(parsed.size);
    bitmap.bits = new Uint8Array(parsed.bits);
    return bitmap;
  }

  // Debug method to check internal state
  debug(): { size: number, bitsSet: number } {
    let bitsSet = 0;
    for (let i = 0; i < this.bits.length; i++) {
      for (let j = 0; j < 8; j++) {
        if (this.bits[i] & (1 << j)) {
          bitsSet++;
        }
      }
    }
    return {
      size: this.size,
      bitsSet
    };
  }
} 