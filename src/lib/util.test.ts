import {describe, it, expect, test} from 'vitest';
import {objAssoc, objDelete, objUpdate, wrap} from './util';

describe('Wrap', () => {
  it('Wrap utility', () => {
    expect(wrap(undefined)).toEqual([]);
    expect(wrap('hi')).toEqual(['hi']);
    expect(wrap([])).toEqual([]);
    expect(wrap(['a', 'b'])).toEqual(['a', 'b']);
  });
});

describe('Object Manipulation', () => {
  test('Object assoc creates missing keys', () => {
    const a: Record<string, any> = {};
    objAssoc(['a', 'b'], 2, a);
    expect(a['a']['b']).toBe(2);
  });

  test('Object assoc preserves keys where possible', () => {
    const a: Record<string, any> = {a: {c: 3}};
    objAssoc(['a', 'b'], 2, a);
    expect(a['a']['b']).toBe(2);
    expect(a['a']['c']).toBe(3);
  });

  test('Object assoc with one key in path assigns', () => {
    const a: Record<string, any> = {};
    objAssoc(['a'], 2, a);
    expect(a['a']).toBe(2);
  });

  test('Object assoc with empty path does nothing', () => {
    const a: Record<string, any> = {};
    objAssoc([], 2, a);
    expect(a).toEqual({});
  });

  test('Object update', () => {
    const a: Record<string, any> = {a: {c: 3}};
    objUpdate(['a', 'c'], x => x + 1, a);
    expect(a['a']['c']).toBe(4);
  });

  test('Object delete', () => {
    const a: Record<string, any> = {a: {c: 3}};
    objDelete(['a', 'c'], [], a);
    expect(a['a']['c']).toEqual(undefined);

    const b: Record<string, any> = {a: {c: 3}};
    objDelete(['a'], ['c'], b);
    expect(b['a']['c']).toBe(undefined);
  });
});
