import { SystemResults, createSystemChange, requireEvents } from './system';
import { describe, it, expect } from 'vitest';
import { World } from './world';
import { System } from '..';

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
  it('Should allow bundles with specified ids', () => {
    const bundle = {
      hp: 10,
      armor: 'heavy',
    };
    const sysres = new SystemResults().addBundle(bundle, 1);
    expect(sysres.changes.length).toBe(2);
    expect(sysres.changes.every(change => change.ids === 1)).true;
  });
});

describe('Required Events Helper', () => {
  it('Result should maintain original name', () => {
    const system = async () => new SystemResults();
    expect(system.name).toBe('system');

    const other = requireEvents(['anything'], system);
    expect(other.name).toBe('system');
  });
  it('Example works', () => {


    let system: System = async () => new SystemResults();
    const onTick = (system: System) => requireEvents(['tick'], system)

    system = onTick(system);
    expect(1).toBe(1);
  });

  it('Should only trigger when specified', async () => {
    // Just has a non-zero change length to distinguish it
    let add: System = async (_: World) => new SystemResults().add(['resources', 'x'], 1);
    let world = new World();

    let result = await add(world)
    expect(result!.changes.length).toBe(1);

    add = requireEvents(['tick'], add);
    result = await add(world)
    expect(result!.changes.length).toBe(0);

    // Add the required event
    world = world.add(['events', 'tick'], 1);
    expect(world.getEvents('tick').length).toBe(1);

    // Expect it to trigger
    result = await add(world)
    expect(result!.changes.length).toBe(1);
  });
});
