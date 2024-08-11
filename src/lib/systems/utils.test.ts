import {describe, it, expect} from 'vitest';
import {Intention} from './intention';
import {requireEvents} from './utils';
import {System} from '@/types/system';
import {World} from '../world';

describe('Required Events Helper', () => {
  it('Result should maintain original name', () => {
    const system = async () => new Intention();
    expect(system.name).toBe('system');

    const other = requireEvents(['anything'], system);
    expect(other.name).toBe('system');
  });
  it('Example works', () => {
    let system: System = async () => new Intention();
    const onTick = (system: System) => requireEvents(['tick'], system);

    system = onTick(system);
    expect(1).toBe(1);
  });

  it('Should only trigger when specified', async () => {
    // Just has a non-zero change length to distinguish it
    let add: System = async (_: World) => new Intention().addResource('x', 1);
    let world = new World();

    let result = await add(world);
    expect(result!.changes.length).toBe(1);

    add = requireEvents(['tick'], add);
    result = await add(world);
    expect(result!.changes.length).toBe(0);

    // Add the required event
    world = world.applyChange({
      method: 'add',
      path: ['events', 'tick'],
      value: 1,
    });
    expect(world.getEvents('tick').length).toBe(1);

    // Expect it to trigger
    result = await add(world);
    expect(result!.changes.length).toBe(1);
  });
});
