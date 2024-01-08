import {ReservedKeys, World} from './world';
import {range} from 'ramda';
import {describe, expect, test} from 'vitest';

describe('Newborn world tests', () => {
  test('Default attributes', () => {
    const world = new World();
    expect(world.events).toEqual({});
    expect(world.resources).toEqual({});
    expect(world.components).toEqual({});
    expect(world.getEntities().length).toBe(0);
  });
});

describe('New Id checks', () => {
  test('Test create entities immutability', () => {
    let world = new World();

    world = world.setResource(ReservedKeys.ENTITY_REVIVAL_QUEUE, []);
    console.log(world);
    world.createEntities(1);
    expect(world.createEntities(5)).toEqual(range(0, 5));
    // Repeated to test immutability
    expect(world.createEntities(5)).toEqual(range(0, 5));
  });
});
