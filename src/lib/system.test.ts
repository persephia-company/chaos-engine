import {SystemResults, createSystemChange} from './system';
import {describe, it, expect} from 'vitest';

describe('System Changes', () => {
  it('Should package messages', () => {
    const change = createSystemChange('add', ['some', 'path'], 'value');
    expect(change.method).toEqual('add');
    expect(change.path).toEqual(['some', 'path']);
    expect(change.value).toEqual('value');
  });
});

describe('System Results', () => {
  it('Should be empty when initialised', () => {
    expect(new SystemResults().changes.length).toBe(0);
  });
  it('Should allow multiple adds', () => {
    const sysres = new SystemResults().add(['nice']).add(['nice']);
    expect(sysres.changes.length).toBe(2);
  });
  it('Should be immutable', () => {
    const sysres = new SystemResults().add(['nice']);
    const other = sysres.add(['pwease']);
    expect(sysres.changes.length).toBe(1);
    expect(other.changes.length).toBe(2);
  });
});
