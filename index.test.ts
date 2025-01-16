import { expect, test, describe } from "bun:test";
import {
  parsePattern,
  validatePattern,
  validateExtensions,
  analyzePattern,
  generateCombinations,
  processPatterns,
  CONSONANTS,
  VOWELS,
  NUMBERS,
  LETTERS,
  ALL_CHARS,
  type PatternPart,
  type DomainHistory
} from './lib';

describe('Pattern Parsing', () => {
  test('parsePattern handles literal text', () => {
    const pattern = 'TEST';
    const parts = parsePattern(pattern);
    expect(parts).toHaveLength(1);
    expect(parts[0].type).toBe('literal');
    expect(parts[0].value).toBe('TEST');
    expect(parts[0].possibilities).toEqual(['test']);
  });

  test('parsePattern handles wildcards', () => {
    const pattern = 'test_';
    const parts = parsePattern(pattern);
    expect(parts).toHaveLength(2);
    expect(parts[0].type).toBe('literal');
    expect(parts[1].type).toBe('wildcard');
    expect(parts[1].possibilities).toEqual(ALL_CHARS);
  });

  test('parsePattern handles special characters', () => {
    const pattern = 'ccvvnll';
    const parts = parsePattern(pattern);
    expect(parts).toHaveLength(7);
    expect(parts[0].type).toBe('c');
    expect(parts[0].possibilities).toEqual(CONSONANTS);
    expect(parts[2].type).toBe('v');
    expect(parts[2].possibilities).toEqual(VOWELS);
    expect(parts[4].type).toBe('n');
    expect(parts[4].possibilities).toEqual(NUMBERS);
    expect(parts[5].type).toBe('l');
    expect(parts[5].possibilities).toEqual(LETTERS);
  });

  test('parsePattern handles mixed patterns', () => {
    const pattern = 'test-l_n';
    const parts = parsePattern(pattern);
    expect(parts).toHaveLength(5);
    expect(parts[0].type).toBe('literal');
    expect(parts[1].type).toBe('-');
    expect(parts[2].type).toBe('l');
    expect(parts[3].type).toBe('wildcard');
    expect(parts[4].type).toBe('n');
  });
});

describe('Pattern Validation', () => {
  test('validates empty pattern', () => {
    expect(validatePattern('')).toBe('Pattern cannot be empty');
  });

  test('validates invalid characters', () => {
    expect(validatePattern('test!')).toContain('Invalid character');
    expect(validatePattern('test*')).toContain('Invalid character');
  });

  test('validates hyphen rules', () => {
    expect(validatePattern('-test')).toContain('cannot start with hyphen');
    expect(validatePattern('test-')).toContain('cannot end with hyphen');
    expect(validatePattern('te--st')).toContain('consecutive hyphens');
  });

  test('validates valid patterns', () => {
    expect(validatePattern('test')).toBeNull();
    expect(validatePattern('test-com')).toBeNull();
    expect(validatePattern('ccvvn')).toBeNull();
    expect(validatePattern('test_com')).toBeNull();
    expect(validatePattern('ll-ll')).toBeNull();
  });
});

describe('Extension Validation', () => {
  test('validates extension format', () => {
    expect(validateExtensions(['.com'])).toBeNull();
    expect(validateExtensions(['com'])).toContain('must start with dot');
    expect(validateExtensions(['.'])).toContain('too short');
    expect(validateExtensions(['.COM'])).toContain('Invalid extension format');
  });

  test('validates multiple extensions', () => {
    expect(validateExtensions(['.com', '.net', '.org'])).toBeNull();
    expect(validateExtensions(['.com', 'net'])).toContain('must start with dot');
  });
});

describe('Domain Generation', () => {
  test('generates valid domains with letters', () => {
    const parts = parsePattern('ll');
    const combinations = Array.from(generateCombinations(parts));
    expect(combinations.length).toBe(LETTERS.length * LETTERS.length);
    expect(combinations.every(c => /^[a-z]{2}$/.test(c))).toBe(true);
  });

  test('generates valid domains with hyphens', () => {
    const parts = parsePattern('l-l');
    const combinations = Array.from(generateCombinations(parts));
    expect(combinations.length).toBe(LETTERS.length * LETTERS.length);
    expect(combinations.every(c => /^[a-z]-[a-z]$/.test(c))).toBe(true);
  });

  test('generates valid domains with wildcards', () => {
    const parts = parsePattern('a_b');
    const combinations = Array.from(generateCombinations(parts));
    expect(combinations.length).toBe(ALL_CHARS.length);
    expect(combinations.every(c => c.startsWith('a') && c.endsWith('b'))).toBe(true);
    // Should not have consecutive hyphens
    expect(combinations.every(c => !c.includes('--'))).toBe(true);
  });

  test('skips invalid domain combinations', () => {
    const parts = parsePattern('_n');
    const combinations = Array.from(generateCombinations(parts));
    // Should not start with hyphen or number
    expect(combinations.every(c => !/^[-0-9]/.test(c))).toBe(true);
  });
});

describe('Pattern Analysis', () => {
  test('analyzes pattern with extensions', () => {
    const pattern = 'll';
    const result = analyzePattern({ pattern, extensions: ['.com'] });
    expect(typeof result).not.toBe('string');
    if (typeof result !== 'string') {
      expect(result.combinations).toBe(LETTERS.length * LETTERS.length);
      expect(result.totalDomains).toBe(result.combinations);
    }
  });

  test('analyzes pattern with multiple extensions', () => {
    const pattern = 'll';
    const result = analyzePattern({ 
      pattern, 
      extensions: ['.com', '.net', '.org'] 
    });
    expect(typeof result).not.toBe('string');
    if (typeof result !== 'string') {
      expect(result.combinations).toBe(LETTERS.length * LETTERS.length);
      expect(result.totalDomains).toBe(result.combinations * 3);
    }
  });
});

describe('Pattern File Processing', () => {
  test('processes pattern file content', () => {
    const input = `
      # Comment line
      test-l  # Test with letter
      ccvv ; extensions=.com,.net  # Test with extensions
      ll_l ; extensions=.dev       # Test with wildcard
    `;
    const patterns = processPatterns(input);
    expect(patterns).toHaveLength(3);
    expect(patterns[0].pattern).toBe('test-l');
    expect(patterns[0].comment).toBe('Test with letter');
    expect(patterns[1].extensions).toEqual(['.com', '.net']);
    expect(patterns[2].pattern).toBe('ll_l');
  });

  test('handles empty and comment-only lines', () => {
    const input = `
      # Comment line
      
      # Another comment
      test
    `;
    const patterns = processPatterns(input);
    expect(patterns).toHaveLength(1);
    expect(patterns[0].pattern).toBe('test');
  });
}); 