import {SystemResults, createSystemChange, requireEvents} from './system';
import {describe, it, expect} from 'vitest';
import {World} from './world';
import {System} from '@/types/system';

describe('System Changes', () => {
  it('Should package messages', () => {
    const change = createSystemChange('add', ['some', 'path'], 'value', 1);
    expect(change.method).toEqual('add');
    expect(change.path).toEqual(['some', 'path']);
    expect(change.value).toEqual('value');
    expect(change.ids).toEqual(1);
  });
});

describe('System Results', () => {
  it('Should be empty when initialised', () => {
    expect(new SystemResults().changes.length).toBe(0);
  });
  it('Should allow multiple adds', () => {
    const sysres = new SystemResults()
      .add(['components', 'test'], 1)
      .add(['components', 'test'], 2);
    expect(sysres.changes.length).toBe(2);
  });
  it('Should be immutable', () => {
    const sysres = new SystemResults().add(['nice'], 1);
    const other = sysres.add(['pwease'], 2);
    expect(sysres.changes.length).toBe(1);
    expect(other.changes.length).toBe(2);
  });
});

describe('Required Events Helper', () => {
  it('Result should maintain original name', () => {
    const system = () => new SystemResults();
    expect(system.name).toBe('system');

    const other = requireEvents(['anything'], system);
    expect(other.name).toBe('system');
  });
  it('Should curry nicely', () => {
    let system = () => new SystemResults();
    const requireTick = requireEvents(['tick']);

    system = requireTick(system);
    expect(1).toBe(1);
  });

  it('Should only trigger when specified', () => {
    // Just has a non-zero change length to distinguish it
    let add: System = () => new SystemResults().add(['resources', 'x'], 1);
    let world = new World();

    expect(add(world).changes.length).toBe(1);

    add = requireEvents(['tick'], add);
    expect(add(world).changes.length).toBe(0);

    // Add the required event
    world = world.add(['events', 'tick'], 1);
    expect(world.getEvents('tick').length).toBe(1);

    // Expect it to trigger
    expect(add(world).changes.length).toBe(1);
  });
});
