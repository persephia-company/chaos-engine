import {ReservedKeys, World} from './world';
import {range} from 'ramda';
import {describe, expect, test} from 'vitest';
import {SystemResults, Plugins} from '..';
import {ReservedStages} from '@/types/world';

const createWorld = () => {
  const result = new World();
  return Plugins.addCorePlugins(result);
};

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
    let world = createWorld();

    world = world.setResource(ReservedKeys.ENTITY_REVIVAL_QUEUE, []);
    expect(world.createEntity()).toBe(0);
    expect(world.createEntities(5)).toEqual(range(0, 5));
    // Repeated to test immutability
    expect(world.createEntities(5)).toEqual(range(0, 5));
  });

  test('Create entities with non-empty revival queue should draw from revival queue', () => {
    let world = createWorld();
    world = world.setResource(ReservedKeys.ENTITY_REVIVAL_QUEUE, [10]);
    world.createEntities(2);
    expect(world.createEntities(2)).toEqual([10, 0]);
  });
});

describe('System Tests', () => {
  const sys1 = (world: World) => new SystemResults();
  const sys2 = (world: World) => new SystemResults();

  test('Can add systems correctly', () => {
    const world = createWorld();
    world.addSystem(sys1);
    world.addSystem(sys2, 'stage');

    const systems = world.getSystems();
    expect(systems[ReservedStages.UPDATE].size).toBe(1);
    expect(systems['stage'].size).toBe(1);
  });

  test('Can add system dependencies', () => {
    const world = createWorld();
    world.addSystem(sys1);
    world.addSystem(sys2);
    world.addSystemDependency(sys1, sys2);

    const dependencies = world.getResourceOr<Record<string, Set<string>>>(
      {},
      ReservedKeys.SYSTEM_DEPENDENCIES
    );
    expect(dependencies[sys1.name].size).toBe(1);
    expect(dependencies[sys1.name].has(sys2.name));
  });

  test('Adding system dependencies without adding the systems does nothing', () => {
    // TODO:
  });
});

describe('API Tests', () => {
  test('Add component', () => {
    let world = createWorld();
    const component = 'test';
    world = world.add(['components', component], 'hi', 1);
    const store = world.getComponentStore<string>(component);
    const ids = world.getEntities();
    expect(store.hasEntity(1), 'Entity with id of 1 is missing').toBe(true);
    expect(store.getComponent(1)).toBe('hi');
    expect(ids.includes(1)).toBe(true);
  });

  test('Add multiple components', () => {
    let world = createWorld();
    const component = 'test';
    world = world.add(['components', component], ['hi', 'there'], [0, 1]);
    const store = world.getComponentStore<string>(component);
    const ids = world.getEntities();
    expect(store.hasEntity(0), 'Entity with id of 0 is missing').toBe(true);
    expect(store.hasEntity(1), 'Entity with id of 1 is missing').toBe(true);
    expect(store.getComponent(0)).toBe('hi');
    expect(store.getComponent(1)).toBe('there');
    expect(ids.includes(0)).toBe(true);
    expect(ids.includes(1)).toBe(true);
  });

  test('Add component without ids', () => {
    let world = createWorld();
    const component = 'test';
    world = world.add(['components', component], 'hi');
    const store = world.getComponentStore<string>(component);
    const ids = world.getEntities();
    expect(store.hasEntity(0), 'Entity with id of 0 is missing').toBe(true);
    expect(store.getComponent(0)).toBe('hi');
    expect(ids.includes(0)).toBe(true);
  });

  test('Add multiple components without ids', () => {
    let world = createWorld();
    const component = 'test';
    world = world.add(['components', component], ['hi', 'there']);
    const store = world.getComponentStore<string>(component);
    const ids = world.getEntities();
    expect(store.hasEntity(0), 'Entity with id of 0 is missing').toBe(true);
    expect(store.hasEntity(1), 'Entity with id of 1 is missing').toBe(true);
    expect(store.getComponent(0)).toBe('hi');
    expect(store.getComponent(1)).toBe('there');
    expect(ids.includes(0)).toBe(true);
    expect(ids.includes(1)).toBe(true);
  });
});

describe('Running The Game', () => {
  test('Avoid infinite loops', () => {
    let world = createWorld();
    world = world.setResource(ReservedKeys.GAME_SHOULD_QUIT, true);
    expect(world.isFinished()).toBe(true);

    // World should exit immediately
    world.play();
    expect(1).toBe(1);
  });
});
