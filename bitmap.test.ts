import { expect, test, describe } from "bun:test";
import { Bitmap } from './lib';

describe('Bitmap', () => {
  test('initialization', () => {
    const bitmap = new Bitmap(1000);
    const debug = bitmap.debug();
    expect(debug.size).toBe(1000);
    expect(debug.bitsSet).toBe(0);
  });

  test('add and test operations', () => {
    const bitmap = new Bitmap(1000);
    
    bitmap.add('test.com');
    expect(bitmap.test('test.com')).toBe(true);
    expect(bitmap.test('other.com')).toBe(false);
    
    bitmap.add('other.com');
    expect(bitmap.test('test.com')).toBe(true);
    expect(bitmap.test('other.com')).toBe(true);
  });

  test('serialization and deserialization', () => {
    const original = new Bitmap(1000);
    original.add('test.com');
    original.add('example.com');
    
    const serialized = original.serialize();
    const deserialized = Bitmap.deserialize(serialized);
    
    const originalDebug = original.debug();
    const deserializedDebug = deserialized.debug();
    expect(deserializedDebug.size).toBe(originalDebug.size);
    expect(deserialized.test('test.com')).toBe(true);
    expect(deserialized.test('example.com')).toBe(true);
    expect(deserialized.test('other.com')).toBe(false);
  });

  test('collision handling', () => {
    const bitmap = new Bitmap(10);  // Small size to force collisions
    const domains = [
      'test1.com',
      'test2.com',
      'test3.com',
      'example1.com',
      'example2.com'
    ];
    
    // Add all domains
    domains.forEach(domain => bitmap.add(domain));
    
    // Verify all domains are properly tracked
    domains.forEach(domain => {
      expect(bitmap.test(domain)).toBe(true);
    });
  });

  test('debug information', () => {
    const bitmap = new Bitmap(1000);
    bitmap.add('test1.com');
    bitmap.add('test2.com');
    
    const debug = bitmap.debug();
    expect(debug.size).toBe(1000);
    expect(debug.bitsSet).toBe(2);
  });

  test('boundary conditions', () => {
    // Test with minimum size
    const minBitmap = new Bitmap(1);
    minBitmap.add('test.com');
    expect(minBitmap.test('test.com')).toBe(true);
    
    // Test with large size
    const largeBitmap = new Bitmap(1_000_000);
    largeBitmap.add('test.com');
    expect(largeBitmap.test('test.com')).toBe(true);
  });

  test('hash distribution', () => {
    const bitmap = new Bitmap(1000);
    const domains = Array.from({ length: 100 }, (_, i) => `test${i}.com`);
    
    // Add all domains
    domains.forEach(domain => bitmap.add(domain));
    
    // Verify all domains are tracked
    domains.forEach(domain => {
      expect(bitmap.test(domain)).toBe(true);
    });
    
    // Check debug info for reasonable distribution
    const debug = bitmap.debug();
    expect(debug.bitsSet).toBe(domains.length);
  });
}); 