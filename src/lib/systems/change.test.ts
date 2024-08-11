import {Change, UpdateComponentChange} from '@/types/change';
import {describe, it, expect} from 'vitest';
import {extractChangeEntityId, incrementChangeOffset, replaceUnborn} from './change';
import {ID} from '../entity';
import {Entity, RealEntity} from '@/types/entity';

describe('replaceUnborn', () => {
  it('on missing id should leave unchanged', () => {
    const change: UpdateComponentChange<number> = {
      path: ['components', 'test'],
      method: 'update',
      fn: x => x,
    };

    const result = replaceUnborn(change, 1, 1);
    expect(result).toEqual(change);
  });

  it('on real id should leave unchanged', () => {
    const change: UpdateComponentChange<number> = {
      path: ['components', 'test'],
      method: 'update',
      fn: x => x,
      id: ID.real(1),
    };

    const result = replaceUnborn(change, 1, 2);
    expect(result).toEqual(change);
  });

  it('on wrong unborn id should leave unchanged', () => {
    const change: UpdateComponentChange<number> = {
      path: ['components', 'test'],
      method: 'update',
      fn: x => x,
      id: ID.unborn(1),
    };

    const result = replaceUnborn(change, 2, 2);
    expect(result).toEqual(change);
  });

  it('on correct, unborn id should make it real.', () => {
    const change: UpdateComponentChange<number> = {
      path: ['components', 'test'],
      method: 'update',
      fn: x => x,
      id: ID.unborn(1),
    };

    const result = replaceUnborn(change, 1, 2);
    expect((new Object(result) as {id: Entity})['id']).toEqual(ID.real(2));
  });
});

describe('extractChangeEntityID', () => {
  it('on missing id should leave unchanged', () => {
    const change: UpdateComponentChange<number, RealEntity> = {
      path: ['components', 'test'],
      method: 'update',
      fn: x => x,
    };

    const result = extractChangeEntityId(change);
    expect(result).toEqual(change);
  });

  it('on real id should work', () => {
    const change: UpdateComponentChange<number, RealEntity> = {
      path: ['components', 'test'],
      method: 'update',
      fn: x => x,
      id: ID.real(1),
    };

    const result = extractChangeEntityId(change);
    // @ts-ignore not casting this shit.
    expect(result.id).toEqual(1);
  });
});

describe('incrementChangeOffset', () => {
  it('on missing id should leave unchanged', () => {
    const change: UpdateComponentChange<number> = {
      path: ['components', 'test'],
      method: 'update',
      fn: x => x,
    };

    const result = incrementChangeOffset(change, 10);
    expect(result).toEqual(change);
  });

  it('on real id should leave unchanged', () => {
    const change: UpdateComponentChange<number> = {
      path: ['components', 'test'],
      method: 'update',
      fn: x => x,
      id: ID.real(1),
    };

    const result = incrementChangeOffset(change, 10);
    expect(result).toEqual(change);
  });

  it('on unborn id should increment its offset', () => {
    const change: UpdateComponentChange<number> = {
      path: ['components', 'test'],
      method: 'update',
      fn: x => x,
      id: ID.unborn(1),
    };

    const result = incrementChangeOffset(change, 10);
    // @ts-ignore
    expect(result.id.offset).toEqual(11);
  });
});
